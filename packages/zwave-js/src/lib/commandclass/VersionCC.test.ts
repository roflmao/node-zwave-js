import { CommandClasses } from "@zwave-js/core";
import { createEmptyMockDriver } from "../../../../../test/mocks";
import { ZWaveLibraryTypes } from "../controller/ZWaveLibraryTypes";
import type { Driver } from "../driver/Driver";
import { ZWaveNode } from "../node/Node";
import { assertCC } from "../test/assertCC";
import { CommandClass, getCommandClass } from "./CommandClass";
import {
	VersionCC,
	VersionCCCapabilitiesGet,
	VersionCCCommandClassGet,
	VersionCCGet,
	VersionCCZWaveSoftwareGet,
} from "./VersionCC";

const fakeDriver = (createEmptyMockDriver() as unknown) as Driver;

describe("lib/commandclass/VersionCC => ", () => {
	const cc = new VersionCC(fakeDriver, { nodeId: 9 });

	it("should be a CommandClass", () => {
		expect(cc).toBeInstanceOf(CommandClass);
	});
	it(`with command class "Version"`, () => {
		expect(getCommandClass(cc)).toBe(CommandClasses.Version);
	});

	// it("should serialize correctly", () => {
	// 	const req = new SendDataRequest(fakeDriver, {
	// 		command: cc,
	// 		transmitOptions: TransmitOptions.DEFAULT,
	// 		callbackId: 36,
	// 	});
	// 	cc.ccCommand = ZWavePlusCommand.Get;
	// 	serialized = req.serialize();
	// 	// A real message from OZW
	// 	expect(serialized).toEqual(
	// 		Buffer.from("0109001309025e012524b0", "hex"),
	// 	);
	// });

	describe(`interview()`, () => {
		const fakeDriver = createEmptyMockDriver();
		const node = new ZWaveNode(2, (fakeDriver as unknown) as Driver);
		let cc: VersionCC;

		function doInterview() {
			return cc.interview(true);
		}

		function mockVersionGet() {
			fakeDriver.sendMessage.mockImplementationOnce(() =>
				// VersionGet response
				Promise.resolve({
					command: {
						libraryType: ZWaveLibraryTypes.Controller,
						protocolVersion: "1.2.3",
						firmwareVersions: ["1.5"],
						hardwareVersion: 5,
					},
				}),
			);
		}
		function mockCCVersionGet(ccVersion: number) {
			fakeDriver.sendMessage.mockImplementationOnce(() =>
				// CCVersion response
				Promise.resolve({ command: { ccVersion } }),
			);
		}
		function resetSendMessageImplementation() {
			fakeDriver.sendMessage.mockImplementation(() =>
				Promise.resolve({ command: {} }),
			);
		}

		beforeAll(() => {
			resetSendMessageImplementation();
			fakeDriver.controller.nodes.set(node.id, node);
			// CC Version must be supported for this test
			node.addCC(CommandClasses.Version, { isSupported: true });
			cc = node.createCCInstance(VersionCC)!;
		});
		beforeEach(() => fakeDriver.sendMessage.mockClear());
		afterAll(() => {
			fakeDriver.sendMessage.mockImplementation(() => Promise.resolve());
		});

		it("should send a VersionCCGet", async () => {
			mockVersionGet();
			// Without this line, Version gets detected as not supported
			mockCCVersionGet(2);

			await doInterview();

			expect(fakeDriver.sendMessage).toBeCalled();
			assertCC(fakeDriver.sendMessage.mock.calls[0][0], {
				nodeId: node.id,
				cc: VersionCCGet,
			});
		});

		it("should send a VersionCCCommandClassGet for each supported CC", async () => {
			mockVersionGet();

			// VersionCC is already supported
			// Without this line, Version gets detected as not supported
			mockCCVersionGet(2);
			node.addCC(CommandClasses["Central Scene"], { isSupported: true });
			mockCCVersionGet(4);

			await doInterview();

			expect(
				fakeDriver.sendMessage.mock.calls.length,
			).toBeGreaterThanOrEqual(3);
			assertCC(fakeDriver.sendMessage.mock.calls[1][0], {
				nodeId: node.id,
				cc: VersionCCCommandClassGet,
				ccValues: {
					requestedCC: CommandClasses.Version,
				},
			});
			assertCC(fakeDriver.sendMessage.mock.calls[2][0], {
				nodeId: node.id,
				cc: VersionCCCommandClassGet,
				ccValues: {
					requestedCC: CommandClasses["Central Scene"],
				},
			});
		});

		it("should not send a VersionCCCapabilitiesGet if the CC version is < 3", async () => {
			mockVersionGet();
			// Set VersionCC version to 2
			mockCCVersionGet(2);
			node.addCC(CommandClasses["Central Scene"], { isSupported: true });
			mockCCVersionGet(4);

			await doInterview();

			expect(fakeDriver.sendMessage.mock.calls.length).toBe(3);
		});

		it("should send a VersionCCCapabilitiesGet if the CC version is >= 3", async () => {
			mockVersionGet();
			// Set VersionCC version to 3
			mockCCVersionGet(3);
			node.addCC(CommandClasses["Central Scene"], { isSupported: true });
			mockCCVersionGet(4);

			// for VersionCCCapabilitiesGet
			fakeDriver.sendMessage.mockImplementation(() =>
				Promise.resolve({
					command: { supportsZWaveSoftwareGet: true },
				}),
			);
			// for ZWaveSoftwareGet to have a value in the ValueDB
			node.valueDB.setValue(
				{
					commandClass: CommandClasses.Version,
					endpoint: 0,
					property: "supportsZWaveSoftwareGet",
				},
				true,
			);

			await doInterview();

			expect(
				fakeDriver.sendMessage.mock.calls.length,
			).toBeGreaterThanOrEqual(4);
			assertCC(fakeDriver.sendMessage.mock.calls[3][0], {
				nodeId: node.id,
				cc: VersionCCCapabilitiesGet,
			});
			assertCC(fakeDriver.sendMessage.mock.calls[4][0], {
				nodeId: node.id,
				cc: VersionCCZWaveSoftwareGet,
			});
		});
	});
});