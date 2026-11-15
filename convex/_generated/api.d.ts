/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as appleProvider from "../appleProvider.js";
import type * as auth from "../auth.js";
import type * as authAdmin from "../authAdmin.js";
import type * as authRedirect from "../authRedirect.js";
import type * as authUsers from "../authUsers.js";
import type * as hops from "../hops.js";
import type * as http from "../http.js";
import type * as lib from "../lib.js";
import type * as openai from "../openai.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";
import type * as wishes from "../wishes.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  appleProvider: typeof appleProvider;
  auth: typeof auth;
  authAdmin: typeof authAdmin;
  authRedirect: typeof authRedirect;
  authUsers: typeof authUsers;
  hops: typeof hops;
  http: typeof http;
  lib: typeof lib;
  openai: typeof openai;
  seed: typeof seed;
  users: typeof users;
  wishes: typeof wishes;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
