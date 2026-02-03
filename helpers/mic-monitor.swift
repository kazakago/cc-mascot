import CoreAudio
import Foundation

// MARK: - Microphone Monitor
// Monitors all audio input devices and reports when any microphone is in use.
// Outputs JSON lines to stdout: {"micActive":true} or {"micActive":false}

var lastReportedState: Bool? = nil

func getAllInputDeviceIDs() -> [AudioDeviceID] {
    var propertyAddress = AudioObjectPropertyAddress(
        mSelector: kAudioHardwarePropertyDevices,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )

    var dataSize: UInt32 = 0
    let status = AudioObjectGetPropertyDataSize(
        AudioObjectID(kAudioObjectSystemObject),
        &propertyAddress,
        0,
        nil,
        &dataSize
    )
    guard status == noErr else { return [] }

    let deviceCount = Int(dataSize) / MemoryLayout<AudioDeviceID>.size
    var deviceIDs = [AudioDeviceID](repeating: 0, count: deviceCount)

    let status2 = AudioObjectGetPropertyData(
        AudioObjectID(kAudioObjectSystemObject),
        &propertyAddress,
        0,
        nil,
        &dataSize,
        &deviceIDs
    )
    guard status2 == noErr else { return [] }

    // Filter to devices with input channels
    return deviceIDs.filter { hasInputChannels($0) }
}

func hasInputChannels(_ deviceID: AudioDeviceID) -> Bool {
    var propertyAddress = AudioObjectPropertyAddress(
        mSelector: kAudioDevicePropertyStreamConfiguration,
        mScope: kAudioDevicePropertyScopeInput,
        mElement: kAudioObjectPropertyElementMain
    )

    var dataSize: UInt32 = 0
    let status = AudioObjectGetPropertyDataSize(deviceID, &propertyAddress, 0, nil, &dataSize)
    guard status == noErr, dataSize > 0 else { return false }

    let bufferListPointer = UnsafeMutablePointer<AudioBufferList>.allocate(capacity: 1)
    defer { bufferListPointer.deallocate() }

    let status2 = AudioObjectGetPropertyData(deviceID, &propertyAddress, 0, nil, &dataSize, bufferListPointer)
    guard status2 == noErr else { return false }

    let bufferList = UnsafeMutableAudioBufferListPointer(bufferListPointer)
    for buffer in bufferList {
        if buffer.mNumberChannels > 0 {
            return true
        }
    }
    return false
}

func isDeviceRunning(_ deviceID: AudioDeviceID) -> Bool {
    var propertyAddress = AudioObjectPropertyAddress(
        mSelector: kAudioDevicePropertyDeviceIsRunningSomewhere,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )

    var isRunning: UInt32 = 0
    var dataSize = UInt32(MemoryLayout<UInt32>.size)

    let status = AudioObjectGetPropertyData(deviceID, &propertyAddress, 0, nil, &dataSize, &isRunning)
    guard status == noErr else { return false }

    return isRunning != 0
}

func checkAndReport() {
    let inputDevices = getAllInputDeviceIDs()
    let anyActive = inputDevices.contains { isDeviceRunning($0) }

    if anyActive != lastReportedState {
        lastReportedState = anyActive
        let json = "{\"micActive\":\(anyActive)}"
        print(json)
        fflush(stdout)
    }
}

func registerListeners() {
    let inputDevices = getAllInputDeviceIDs()

    for deviceID in inputDevices {
        var propertyAddress = AudioObjectPropertyAddress(
            mSelector: kAudioDevicePropertyDeviceIsRunningSomewhere,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain
        )

        AudioObjectAddPropertyListenerBlock(deviceID, &propertyAddress, DispatchQueue.main) { _, _ in
            checkAndReport()
        }
    }

    // Also listen for device additions/removals to handle hotplug
    var devicesAddress = AudioObjectPropertyAddress(
        mSelector: kAudioHardwarePropertyDevices,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
    )

    AudioObjectAddPropertyListenerBlock(
        AudioObjectID(kAudioObjectSystemObject),
        &devicesAddress,
        DispatchQueue.main
    ) { _, _ in
        // Re-register listeners for new devices
        registerListeners()
        checkAndReport()
    }
}

// MARK: - Main

// Report initial state
checkAndReport()

// Register CoreAudio listeners
registerListeners()

// Keep the process alive
RunLoop.main.run()
