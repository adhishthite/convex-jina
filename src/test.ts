/// <reference types="vite/client" />
import schema from "./component/schema.js";

const modules = import.meta.glob("./component/**/*.ts");

export function register(t: any, name = "jina") {
	t.registerComponent(name, schema, modules);
}

export default { register, schema, modules };
