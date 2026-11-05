import { Config } from "@remotion/cli/config";

Config.setEntryPoint("./src/index.ts");
Config.setBrowserExecutable("/usr/bin/google-chrome-stable");
Config.setChromiumOpenGlRenderer("angle");
Config.setConcurrency(3);
Config.setOverwriteOutput(true);
