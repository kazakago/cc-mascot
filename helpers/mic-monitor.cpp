// Microphone Monitor for Windows
// Monitors all audio capture devices and reports when any microphone is in use.
// Outputs JSON lines to stdout: {"micActive":true} or {"micActive":false}
//
// Uses WASAPI (Windows Audio Session API) to enumerate active capture sessions.
// Polls every 2 seconds and reports only on state changes.
//
// Build: cl /O2 /EHsc mic-monitor.cpp Ole32.lib /Fe:mic-monitor.exe

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <mmdeviceapi.h>
#include <audiopolicy.h>
#include <stdio.h>

#pragma comment(lib, "Ole32.lib")

static bool lastReportedState = false;
static bool isFirstReport = true;

static bool checkMicrophoneActive() {
    IMMDeviceEnumerator *pEnumerator = nullptr;
    HRESULT hr = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr,
                                 CLSCTX_ALL, __uuidof(IMMDeviceEnumerator),
                                 (void **)&pEnumerator);
    if (FAILED(hr))
        return false;

    IMMDeviceCollection *pCollection = nullptr;
    hr = pEnumerator->EnumAudioEndpoints(eCapture, DEVICE_STATE_ACTIVE,
                                         &pCollection);
    if (FAILED(hr)) {
        pEnumerator->Release();
        return false;
    }

    UINT count = 0;
    pCollection->GetCount(&count);

    bool anyActive = false;
    for (UINT i = 0; i < count && !anyActive; i++) {
        IMMDevice *pDevice = nullptr;
        hr = pCollection->Item(i, &pDevice);
        if (FAILED(hr))
            continue;

        IAudioSessionManager2 *pSessionManager = nullptr;
        hr = pDevice->Activate(__uuidof(IAudioSessionManager2), CLSCTX_ALL,
                               nullptr, (void **)&pSessionManager);
        if (SUCCEEDED(hr)) {
            IAudioSessionEnumerator *pSessionEnum = nullptr;
            hr = pSessionManager->GetSessionEnumerator(&pSessionEnum);
            if (SUCCEEDED(hr)) {
                int sessionCount = 0;
                pSessionEnum->GetCount(&sessionCount);
                for (int j = 0; j < sessionCount; j++) {
                    IAudioSessionControl *pSessionControl = nullptr;
                    hr = pSessionEnum->GetSession(j, &pSessionControl);
                    if (SUCCEEDED(hr)) {
                        AudioSessionState state;
                        hr = pSessionControl->GetState(&state);
                        if (SUCCEEDED(hr) &&
                            state == AudioSessionStateActive) {
                            anyActive = true;
                        }
                        pSessionControl->Release();
                    }
                    if (anyActive)
                        break;
                }
                pSessionEnum->Release();
            }
            pSessionManager->Release();
        }
        pDevice->Release();
    }

    pCollection->Release();
    pEnumerator->Release();

    return anyActive;
}

static void checkAndReport() {
    bool anyActive = checkMicrophoneActive();
    if (isFirstReport || anyActive != lastReportedState) {
        isFirstReport = false;
        lastReportedState = anyActive;
        printf("{\"micActive\":%s}\n", anyActive ? "true" : "false");
        fflush(stdout);
    }
}

int main() {
    HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    if (FAILED(hr)) {
        fprintf(stderr, "COM initialization failed: 0x%lx\n", hr);
        return 1;
    }

    setvbuf(stdout, nullptr, _IONBF, 0);

    checkAndReport();

    while (true) {
        Sleep(2000);
        checkAndReport();
    }

    CoUninitialize();
    return 0;
}
