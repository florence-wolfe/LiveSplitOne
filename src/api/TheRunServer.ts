import { ServerProtocol } from "../livesplit-core/livesplit_core";
import { Event, TimeRef, TimeSpanRef, TimingMethod } from "../livesplit-core";
import { type LSOCommandSink } from "../ui/LSOCommandSink";
import { debounce } from "../util/Debounce";
import { isUUID } from "../util/IsUuid";

export interface TheRunServerSettings {
  key: string;
  isStatsUploadingEnabled: boolean;
  isLiveTrackingEnabled: boolean;
  enabled: boolean;
  keyState: "PENDING" | "VALID" | "INVALID";
}

export const THE_RUN_SETTINGS_DEFAULT: TheRunServerSettings = {
  key: "",
  keyState: "INVALID",
  isStatsUploadingEnabled: false,
  isLiveTrackingEnabled: false,
  enabled: false,
};

interface Comparison {
  name: string;
  time: number | null;
}
interface RunData {
  name: string;
  splitTime: number | null;
  pbSplitTime: number | null;
  bestPossible: number | null;
  comparisons: Comparison[];
}

// Keeping everything static to avoid instantiating a class. It's a singleton.
// We want the class for encapsulation and colocation.
// Hindsight after writing the above; Should have been an instance in state like the LS Server
// This way we could hold onto the general settings state here instead of passing it all around
class TheRunServer {
  splitWebhookUrl =
    "https://dspc6ekj2gjkfp44cjaffhjeue0fbswr.lambda-url.eu-west-1.on.aws/";
  fileUploadBaseUrl =
    "https://2uxp372ks6nwrjnk6t7lqov4zu0solno.lambda-url.eu-west-1.on.aws/";
  keyValidationUrl = "https://api.therun.gg/users/uploadKey/validate/";

  getGameAndCategory = (commandSink: LSOCommandSink) => {
    const run = commandSink.getRun();
    const game = run.gameName();
    const category = run.categoryName();
    return { game, category };
  };

  convertTime = (timeRef: TimeRef, timingMethod: TimingMethod) => {
    let timeSpanRef: TimeSpanRef | null;

    switch (timingMethod) {
      case TimingMethod.RealTime: {
        timeSpanRef = timeRef.realTime();
        break;
      }
      case TimingMethod.GameTime: {
        timeSpanRef = timeRef.gameTime();
        break;
      }
      default: {
        timeSpanRef = null;
        break;
      }
    }
    if (!timeSpanRef) return null;
    const wholeSeconds = timeSpanRef.wholeSeconds() ?? 0;
    const subSecondNanoseconds = timeSpanRef.subsecNanoseconds() ?? 0;

    const time =
      Number(wholeSeconds) * 1000 + Number(subSecondNanoseconds) / 100000;
    return time;
  };

  buildLiveRunData = async (
    game: string,
    category: string,
    commandSink: LSOCommandSink,
  ) => {
    const run = commandSink.getRun();
    const runMetadata = run.metadata();
    const segments = Array.from({ length: run.segmentsLen() }, (_, i) =>
      run.segment(i),
    );
    const timingMethod = commandSink.currentTimingMethod();
    const command = {
      command: "getCurrentRunSplitTime",
      // index: commandSink.currentSplitIndex(),
      relative: true,
      // timing_method: "GameTime",
    };
    try {
      const splitTime = await ServerProtocol.handleCommand(
        JSON.stringify(command),
        commandSink.getCommandSink().ptr,
      );
      console.log({ splitTime });
    } catch (error) {
      // specifically catches out of bounds errors
      console.log({ error });
    }
    const runData = segments.map((segment) => {
      return {
        name: segment.name(),
        bestPossible: this.convertTime(segment.bestSegmentTime(), timingMethod),
        pbSplitTime: this.convertTime(
          segment.personalBestSplitTime(),
          timingMethod,
        ),
        comparisons: commandSink.getAllComparisons().map((comparisonName) => ({
          name: comparisonName,
          time: this.convertTime(
            segment.comparison(comparisonName),
            timingMethod,
          ),
        })),
      };
    });

    const metadata = {
      game,
      category,
      platform: runMetadata.platformName(),
      region: runMetadata.regionName(),
      emulator: runMetadata.usesEmulator(),
      variables: Array.from(commandSink.getAllCustomVariables()),
    };
  };

  handleEvent({
    event,
    state,
    commandSink,
  }: {
    event: Event;
    state: TheRunServerSettings;
    commandSink: LSOCommandSink;
  }): void {
    switch (event) {
      case Event.Started:
      case Event.Splitted:
      case Event.SplitSkipped:
      case Event.SplitUndone:
      case Event.PausesUndone:
        // Fire and Forget baybeeeee
        // Pray and Spray for The Run
        void this.handleSplit(state, commandSink);
        break;
      default: {
        return;
      }
    }
  }

  updateSplitState = (
    state: TheRunServerSettings,
    commandSink: LSOCommandSink,
  ) => {
    // const data = this.buildLiveRunData(commandSink);
  };

  handleSplit = async (
    state: TheRunServerSettings,
    commandSink: LSOCommandSink,
  ) => {
    const { game, category } = this.getGameAndCategory(commandSink);
    // TheRun wants both game and category for valid splits uploads
    if (!game || !category) return;
    // We're not going to do this unless we have opted in
    if (!state.isLiveTrackingEnabled) return;

    const data = await this.buildLiveRunData(game, category, commandSink);
    console.log({ data });
  };

  validatekey = debounce(async (key: string): Promise<boolean> => {
    if (!key || !isUUID(key)) {
      return false;
    }

    const uri = `${this.keyValidationUrl}${key}`;
    try {
      const response = await fetch(uri, {
        method: "GET",
      });
      // Handle any non-200 status code without throwing
      if (!response.ok) {
        return false;
      }
      return response.status === 200;
    } catch (error) {
      return false;
    }
  });
}

const instance = new TheRunServer();
export { instance as TheRunServer };
