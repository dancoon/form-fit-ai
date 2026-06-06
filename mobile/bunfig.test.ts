import { register } from "tsconfig-paths";
import tsconfig from "./tsconfig.json";

register({
  baseUrl: ".",
  paths: tsconfig.compilerOptions.paths,
});
