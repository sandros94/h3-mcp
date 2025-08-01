import { defineBuildConfig } from "obuild/config";

export default defineBuildConfig({
  entries: [
    {
      type: "bundle",
      input: ["src/types/index.ts", "src/index.ts"],
    },
  ],
});
