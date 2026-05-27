import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeSpeechRecognition extends EventTarget {
  static instances: FakeSpeechRecognition[] = [];

  continuous = false;
  interimResults = false;
  lang = "";
  maxAlternatives = 1;
  startCount = 0;
  stopCount = 0;

  constructor() {
    super();
    FakeSpeechRecognition.instances.push(this);
  }

  start() {
    this.startCount += 1;
    this.dispatchEvent(new Event("start"));
  }

  stop() {
    this.stopCount += 1;
    this.dispatchEvent(new Event("end"));
  }

  emitFinal(transcript: string) {
    const result = [{ transcript }] as Array<{ transcript: string }> & {
      isFinal: boolean;
    };
    result.isFinal = true;
    const event = new Event("result") as Event & {
      resultIndex: number;
      results: Array<typeof result>;
    };
    Object.defineProperty(event, "resultIndex", { value: 0 });
    Object.defineProperty(event, "results", { value: [result] });
    this.dispatchEvent(event);
  }

  emitInterim(transcript: string) {
    const result = [{ transcript }] as Array<{ transcript: string }> & {
      isFinal: boolean;
    };
    result.isFinal = false;
    const event = new Event("result") as Event & {
      resultIndex: number;
      results: Array<typeof result>;
    };
    Object.defineProperty(event, "resultIndex", { value: 0 });
    Object.defineProperty(event, "results", { value: [result] });
    this.dispatchEvent(event);
  }

  emitError(error: string) {
    const event = new Event("error") as Event & { error: string };
    Object.defineProperty(event, "error", { value: error });
    this.dispatchEvent(event);
  }
}

function installDemoDom() {
  document.body.innerHTML = `
    <div id="commandChips"></div>
    <form id="commandForm"><input id="commandInput" /></form>
    <div id="exitButtons"></div>
    <div id="gameLog"></div>
    <div id="inventoryState"></div>
    <div id="micState"></div>
    <div id="partialText"></div>
    <div id="recognizerState"></div>
    <div id="roomMap"></div>
    <button id="startVoice" type="button"></button>
    <div id="statusLine"></div>
    <button id="stopVoice" type="button"></button>
    <div id="storeState"></div>
    <div id="turnState"></div>
  `;
}

describe("voice MUD browser demo", () => {
  const originalSpeechRecognition = (window as any).SpeechRecognition;
  const originalWebkitSpeechRecognition = (window as any).webkitSpeechRecognition;
  const originalMediaDevices = Object.getOwnPropertyDescriptor(
    window.navigator,
    "mediaDevices",
  );

  beforeEach(() => {
    vi.resetModules();
    FakeSpeechRecognition.instances = [];
    installDemoDom();
    (window as any).SpeechRecognition = FakeSpeechRecognition;
    (window as any).webkitSpeechRecognition = FakeSpeechRecognition;
    Object.defineProperty(window.navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: vi.fn() }],
        })),
      },
    });
  });

  afterEach(() => {
    (window as any).SpeechRecognition = originalSpeechRecognition;
    (window as any).webkitSpeechRecognition = originalWebkitSpeechRecognition;
    if (originalMediaDevices) {
      Object.defineProperty(window.navigator, "mediaDevices", originalMediaDevices);
    } else {
      delete (window.navigator as any).mediaDevices;
    }
  });

  it("renders typed and spoken commands without losing demo state", async () => {
    await import("../demo/voice-mud.js");

    const commandInput = document.querySelector<HTMLInputElement>("#commandInput");
    const commandForm = document.querySelector<HTMLFormElement>("#commandForm");
    const startVoice = document.querySelector<HTMLButtonElement>("#startVoice");
    const stopVoice = document.querySelector<HTMLButtonElement>("#stopVoice");

    expect(document.querySelector("#storeState")?.textContent).toBe("demo mirror");
    expect(document.querySelector("#recognizerState")?.textContent).toBe("Web Speech");
    expect(document.querySelector("#statusLine")?.textContent).toBe("Rain Market");
    expect(document.querySelectorAll("#commandChips button")).toHaveLength(10);

    commandInput!.value = "west";
    commandForm!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(document.querySelector("#statusLine")?.textContent).toBe("Flooded Archive");
    expect(document.querySelector("#turnState")?.textContent).toBe("1");

    startVoice!.click();
    await vi.waitFor(() => expect(FakeSpeechRecognition.instances).toHaveLength(1));
    expect(document.querySelector("#micState")?.textContent).toBe("granted");
    expect(startVoice!.disabled).toBe(true);

    const [recognizer] = FakeSpeechRecognition.instances;
    recognizer.emitInterim("take");
    expect(document.querySelector("#partialText")?.textContent).toBe("take");

    recognizer.emitFinal("take key");
    expect(document.querySelector("#inventoryState")?.textContent).toBe("key");
    expect(document.querySelector("#partialText")?.textContent).toBe("Heard: take key");

    recognizer.emitError("not-allowed");
    expect(document.querySelector("#micState")?.textContent).toBe("denied");
    expect(document.querySelector("#statusLine")?.classList.contains("error")).toBe(true);

    stopVoice!.click();
    expect(stopVoice!.disabled).toBe(true);
    expect(document.querySelector("#partialText")?.textContent).toBe("No speech yet.");
  });
});
