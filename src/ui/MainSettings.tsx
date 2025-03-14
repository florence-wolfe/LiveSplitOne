import * as React from "react";

import { JsonSettingValueFactory, SettingsComponent } from "./Settings";
import { SettingsDescriptionJson, SettingValue, HotkeyConfig } from "../livesplit-core";
import { toast } from "react-toastify";
import { UrlCache } from "../util/UrlCache";
import { FRAME_RATE_AUTOMATIC as FRAME_RATE_BATTERY_AWARE, FRAME_RATE_MATCH_SCREEN as FRAME_RATE_MATCH_SCREEN, FrameRateSetting } from "../util/FrameRate";
import { LiveSplitServer } from "../api/LiveSplitServer";
import { TheRunServer, type TheRunServerSettings } from "../api/TheRunServer";
import { Option } from "../util/OptionUtil";
import { LSOCommandSink } from "./LSOCommandSink";

import "../css/SettingsEditor.scss";

export interface GeneralSettings {
    frameRate: FrameRateSetting,
    showControlButtons: boolean,
    manualGameTime: ManualGameTimeSettings,
    saveOnReset: boolean,
    speedrunComIntegration: boolean,
    splitsIoIntegration: boolean,
    theRunIntegation: TheRunServerSettings
    serverUrl?: string,
    alwaysOnTop?: boolean,
}

export interface ManualGameTimeSettings {
    enabled: boolean;
    mode: string,
}

export const MANUAL_GAME_TIME_MODE_SEGMENT_TIMES = "Segment Times";
export const MANUAL_GAME_TIME_MODE_SPLIT_TIMES = "Split Times";
export const MANUAL_GAME_TIME_SETTINGS_DEFAULT: ManualGameTimeSettings = {
    mode: MANUAL_GAME_TIME_MODE_SEGMENT_TIMES,
    enabled: false,
};

export interface Props {
    generalSettings: GeneralSettings,
    hotkeyConfig: HotkeyConfig,
    urlCache: UrlCache,
    callbacks: Callbacks,
    serverConnection: Option<LiveSplitServer>,
    commandSink: LSOCommandSink,
    allComparisons: string[],
    allVariables: Set<string>,
}

export interface State {
    settings: SettingsDescriptionJson,
    generalSettings: GeneralSettings,
}

interface Callbacks {
    renderViewWithSidebar(renderedView: JSX.Element, sidebarContent: JSX.Element): JSX.Element,
    closeMainSettings(save: boolean, newGeneralSettings: GeneralSettings): void,
    onServerConnectionOpened(serverConnection: LiveSplitServer): void,
    onServerConnectionClosed(): void,
    forceUpdate(): void,
}

export class MainSettings extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            settings: props.hotkeyConfig.settingsDescriptionAsJson(),
            generalSettings: { ...props.generalSettings },
        };
    }

    public render() {
        const renderedView = this.renderView();
        const sidebarContent = this.renderSidebarContent();
        return this.props.callbacks.renderViewWithSidebar(renderedView, sidebarContent);
    }

    private renderView() {
        const generalFields = [
            {
                text: "Frame Rate",
                tooltip: "Determines the frame rate at which to display the timer. \"Battery Aware\" tries determining the type of device and charging status to select a good frame rate. \"Match Screen\" makes the timer match the screen's refresh rate.",
                value: {
                    CustomCombobox: {
                        value: this.state.generalSettings.frameRate === FRAME_RATE_MATCH_SCREEN ? FRAME_RATE_MATCH_SCREEN : this.state.generalSettings.frameRate === FRAME_RATE_BATTERY_AWARE ? FRAME_RATE_BATTERY_AWARE : this.state.generalSettings.frameRate.toString() + " FPS",
                        list: [FRAME_RATE_BATTERY_AWARE, "30 FPS", "60 FPS", "120 FPS", FRAME_RATE_MATCH_SCREEN],
                        mandatory: true,
                    }
                },
            },
            {
                text: "Save On Reset",
                tooltip: "Determines whether to automatically save the splits when resetting the timer.",
                value: {
                    Bool: this.state.generalSettings.saveOnReset,
                },
            },
            {
                text: "Show Control Buttons",
                tooltip: "Determines whether to show buttons beneath the timer that allow controlling it. When disabled, you have to use the hotkeys instead.",
                value: { Bool: this.state.generalSettings.showControlButtons },
            },
            {
                text: "Show Manual Game Time Input",
                tooltip: "Shows a text box beneath the timer that allows you to manually input the game time. You start the timer and do splits by pressing the Enter key in the text box. Make sure to compare against \"Game Time\".",
                value: { Bool: this.state.generalSettings.manualGameTime.enabled !== false },
            },
        ];

        let manualGameTimeModeIndex = 0;
        if (this.state.generalSettings.manualGameTime.enabled) {
            manualGameTimeModeIndex = generalFields.length;
            generalFields.push({
                text: "Manual Game Time Mode",
                tooltip: "Determines whether to input the manual game time as segment times or split times.",
                value: {
                    CustomCombobox: {
                        value: this.state.generalSettings.manualGameTime.mode,
                        list: [MANUAL_GAME_TIME_MODE_SEGMENT_TIMES, MANUAL_GAME_TIME_MODE_SPLIT_TIMES],
                        mandatory: false,
                    }
                },
            });
        }

        let alwaysOnTopIndex = 0;
        if (window.__TAURI__ != null) {
            alwaysOnTopIndex = generalFields.length;
            generalFields.push({
                text: "Always On Top",
                tooltip: "Keeps the window always on top of other windows.",
                value: { Bool: this.state.generalSettings.alwaysOnTop! },
            });
        }

        const networkFields = [
            {
                key: 'speedrunComIntegration',
                text: "Speedrun.com Integration",
                tooltip: "Queries the list of games, categories, and the leaderboards from speedrun.com.",
                value: { Bool: this.state.generalSettings.speedrunComIntegration },
            },
            {
                key: 'splitsIoIntegration',
                text: "Splits.io Integration",
                tooltip: "Allows you to upload splits to and download splits from splits.io.",
                value: { Bool: this.state.generalSettings.splitsIoIntegration },
            },
            {
                key: 'serverConnection',
                text: <>
                    Server Connection <i className="fa fa-flask" style={{ color: "#07bc0c" }} aria-hidden="true" />
                </>,
                tooltip: <>
                    Allows you to connect to a WebSocket server that can control the timer by sending various commands. The commands are currently a subset of the commands the original LiveSplit supports.<br /><br />
                    This feature is <b>experimental</b> and the protocol will likely change in the future.
                </>,
                value: {
                    ServerConnection: {
                        url: this.props.generalSettings.serverUrl,
                        connection: this.props.serverConnection,
                    },
                }
            },
            {
                key: 'theRunIntegration',
                text: <>
                    TheRun.gg Integration <i className="fa fa-flask" style={{ color: "#07bc0c" }} aria-hidden="true" />
                </>,
                tooltip: <>
                    Allows you to connect to TheRun.gg's WebSocket to upload your splits in real-time.
                    This is an <>experimental</> feature. Visit <a href="https://therun.gg/contact">therun.gg/contact</a> if there are any issues.
                </>,
                value: {
                    Bool: this.state.generalSettings.theRunIntegation.enabled,
                }
            },
        ];

        let theRunServerIntegrationIndex = 0;
        if (this.state.generalSettings.theRunIntegation.enabled) {
            theRunServerIntegrationIndex = networkFields.findIndex(field => field.key === 'theRunIntegration');
            let icon: JSX.IntrinsicElements['i'];
            switch (this.state.generalSettings.theRunIntegation.keyState) {
                case 'PENDING': {
                    icon = <i className="fa fa-spinner fa-spin"></i>;
                    break;
                }
                case 'VALID': {
                    icon = <i className="fa fa-circle" style={{ color: "#07bc0c" }} />;
                    break;
                }
                case 'INVALID': {
                    icon = <i className="fa fa-circle" style={{ color: "red" }} />;
                    break;
                }
                default: {
                    icon = <i className="fa fa-circle" style={{ color: "red" }} />;
                    break;
                }
            }

            // Add the 2 fields after the The Run integration
            networkFields.splice(theRunServerIntegrationIndex + 1, 0, ...[
                {
                    key: 'theRunUploadKey',
                    text: <>Add Upload Key {icon}</>,
                    tooltip: "Add your The Run upload key to automatically upload your splits in real-time.",
                    value: {
                        // @ts-expect-error it's just angry but works.
                        HiddenRemovableString: this.state.generalSettings.theRunIntegation.key,
                    },
                },
                {
                    key: 'isStatsUploadingEnabled',
                    text: "Enable Automated Stats Uploading",
                    tooltip: "Determines whether to automatically upload game stats in real-time via The Run's socket connection.",
                    value: {
                        Bool: this.state.generalSettings.theRunIntegation.isStatsUploadingEnabled!,
                    },
                },
                {
                    key: 'isLiveTrackingEnabled',
                    text: "Enable Live Tracking",
                    tooltip: "Determines whether to automatically update the timer in real-time via The Run's socket connection.",
                    value: {
                        Bool: this.state.generalSettings.theRunIntegation.isLiveTrackingEnabled!,
                    },
                }]);
        }

        return (
            <div className="settings-editor" >
                <h2>Hotkeys</h2>
                <SettingsComponent
                    context="settings-editor-hotkeys"
                    factory={SettingValue}
                    state={this.state.settings}
                    editorUrlCache={this.props.urlCache}
                    allComparisons={this.props.allComparisons}
                    allVariables={this.props.allVariables}
                    setValue={(index, value) => {
                        if (!this.props.hotkeyConfig.setValue(index, value)) {
                            toast.error("The hotkey is already in use.");
                            return;
                        }
                        this.update();
                    }}
                />
                <h2>General</h2>
                <SettingsComponent
                    context="settings-editor-general"
                    factory={new JsonSettingValueFactory()}
                    state={{
                        fields: generalFields,
                    }}
                    editorUrlCache={this.props.urlCache}
                    allComparisons={this.props.allComparisons}
                    allVariables={this.props.allVariables}
                    setValue={(index, value) => {
                        switch (index) {
                            case 0:
                                if ("String" in value) {
                                    this.setState({
                                        generalSettings: {
                                            ...this.state.generalSettings,
                                            frameRate: value.String === FRAME_RATE_MATCH_SCREEN
                                                ? FRAME_RATE_MATCH_SCREEN
                                                : value.String === FRAME_RATE_BATTERY_AWARE
                                                    ? FRAME_RATE_BATTERY_AWARE
                                                    : parseInt(value.String.split(' ')[0], 10) as FrameRateSetting,
                                        },
                                    });
                                }
                                break;
                            case 1:
                                if ("Bool" in value) {
                                    this.setState({
                                        generalSettings: {
                                            ...this.state.generalSettings,
                                            saveOnReset: value.Bool,
                                        },
                                    });
                                }
                                break;
                            case 2:
                                if ("Bool" in value) {
                                    this.setState({
                                        generalSettings: {
                                            ...this.state.generalSettings,
                                            showControlButtons: value.Bool,
                                        },
                                    });
                                }
                                break;
                            case 3:
                                if ("Bool" in value) {
                                    this.setState({
                                        generalSettings: {
                                            ...this.state.generalSettings,
                                            manualGameTime: {
                                                ...this.state.generalSettings.manualGameTime,
                                                enabled: value.Bool,
                                            }
                                        },
                                    });
                                }
                                break;
                            default:
                                if (index === alwaysOnTopIndex && "Bool" in value) {
                                    this.setState({
                                        generalSettings: {
                                            ...this.state.generalSettings,
                                            alwaysOnTop: value.Bool,
                                        },
                                    });
                                } else if (index === manualGameTimeModeIndex && "String" in value) {
                                    this.setState({
                                        generalSettings: {
                                            ...this.state.generalSettings,
                                            manualGameTime: {
                                                ...this.state.generalSettings.manualGameTime,
                                                mode: value.String,
                                            },
                                        },
                                    });
                                }
                                break;
                        }
                    }}
                />
                <h2>Network</h2>
                <SettingsComponent
                    context="settings-editor-general"
                    factory={new JsonSettingValueFactory()}
                    state={{
                        fields: networkFields,
                    }}
                    editorUrlCache={this.props.urlCache}
                    allComparisons={this.props.allComparisons}
                    allVariables={this.props.allVariables}
                    setValue={(index, value) => {
                        switch (index) {
                            case 0:
                                if ("Bool" in value) {
                                    this.setState({
                                        generalSettings: {
                                            ...this.state.generalSettings,
                                            speedrunComIntegration: value.Bool,
                                        },
                                    });
                                }
                                break;
                            case 1:
                                if ("Bool" in value) {
                                    this.setState({
                                        generalSettings: {
                                            ...this.state.generalSettings,
                                            splitsIoIntegration: value.Bool,
                                        },
                                    });
                                }
                                break;
                            case 2:
                                if ("String" in value) {
                                    try {
                                        this.props.callbacks.onServerConnectionOpened(new LiveSplitServer(
                                            value.String,
                                            () => this.forceUpdate(),
                                            () => this.props.callbacks.onServerConnectionClosed(),
                                            this.props.commandSink,
                                        ));
                                        this.setState({
                                            generalSettings: {
                                                ...this.state.generalSettings,
                                                serverUrl: value.String
                                            },
                                        });
                                    } catch {
                                        // It's fine if it fails.
                                    }
                                }
                                break;
                            case 3:
                                if ("Bool" in value) {
                                    this.setState({
                                        generalSettings: {
                                            ...this.state.generalSettings,
                                            theRunIntegation: {
                                                ...this.state.generalSettings.theRunIntegation,
                                                enabled: value.Bool,
                                            },
                                        },
                                    });
                                }
                                break;
                            default:
                                // First is the run integration key
                                if (index === theRunServerIntegrationIndex + 1 && "HiddenRemovableString" in value) {
                                    this.setState({
                                        generalSettings: {
                                            ...this.state.generalSettings,
                                            theRunIntegation: {
                                                ...this.state.generalSettings.theRunIntegation,
                                                // If we change the key immediately set this to pending since we're going to check the validity
                                                keyState: !value.HiddenRemovableString ? 'INVALID' : 'PENDING',
                                                key: value.HiddenRemovableString ?? '',
                                            },
                                        },
                                    });

                                    if (!value.HiddenRemovableString) {
                                        break;
                                    }

                                    TheRunServer.validatekey(value.HiddenRemovableString).then((isValid) => {
                                        this.setState({
                                            generalSettings: {
                                                ...this.state.generalSettings,
                                                theRunIntegation: {
                                                    ...this.state.generalSettings.theRunIntegation,
                                                    keyState: isValid ? 'VALID' : 'INVALID',
                                                },
                                            }
                                        });
                                    }).catch(() => {
                                        this.setState({
                                            generalSettings: {
                                                ...this.state.generalSettings,
                                                theRunIntegation: {
                                                    ...this.state.generalSettings.theRunIntegation,
                                                    keyState: 'INVALID',
                                                },
                                            }
                                        });
                                    });
                                }

                                // First Bool after the run integration is the stats uploading toggle
                                if (index === theRunServerIntegrationIndex + 2 && "Bool" in value) {
                                    this.setState({
                                        generalSettings: {
                                            ...this.state.generalSettings,
                                            theRunIntegation: {
                                                ...this.state.generalSettings.theRunIntegation,
                                                isStatsUploadingEnabled: value.Bool
                                            }
                                        },
                                    });
                                }
                                // 2nd Bool after the run integration is the live tracking
                                if (index === theRunServerIntegrationIndex + 3 && "Bool" in value) {
                                    this.setState({
                                        generalSettings: {
                                            ...this.state.generalSettings,
                                            theRunIntegation: {
                                                ...this.state.generalSettings.theRunIntegation,
                                                isLiveTrackingEnabled: value.Bool
                                            },
                                        },
                                    });
                                }
                        }
                    }}
                />
            </div>
        );
    }

    private renderSidebarContent() {
        return (
            <div className="sidebar-buttons">
                <h1>Settings</h1>
                <hr />
                <div className="small">
                    <button
                        className="toggle-left"
                        onClick={(_) => this.props.callbacks.closeMainSettings(true, this.state.generalSettings)}
                    >
                        <i className="fa fa-check" aria-hidden="true" /> OK
                    </button>
                    <button
                        className="toggle-right"
                        onClick={(_) => this.props.callbacks.closeMainSettings(false, this.state.generalSettings)}
                    >
                        <i className="fa fa-times" aria-hidden="true" /> Cancel
                    </button>
                </div>
            </div>
        );
    }

    private update() {
        this.setState({
            settings: this.props.hotkeyConfig.settingsDescriptionAsJson(),
        });
    }
}
