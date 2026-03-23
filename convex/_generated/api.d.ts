/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as affiliates from "../affiliates.js";
import type * as apiKeyActions from "../apiKeyActions.js";
import type * as apiKeys from "../apiKeys.js";
import type * as contacts from "../contacts.js";
import type * as crons from "../crons.js";
import type * as domainActions from "../domainActions.js";
import type * as domainHealth from "../domainHealth.js";
import type * as domainHealthQueries from "../domainHealthQueries.js";
import type * as domains from "../domains.js";
import type * as emailStats from "../emailStats.js";
import type * as emailVerification from "../emailVerification.js";
import type * as emailVerificationQueries from "../emailVerificationQueries.js";
import type * as emails from "../emails.js";
import type * as http from "../http.js";
import type * as inboxPlacement from "../inboxPlacement.js";
import type * as mailboxes from "../mailboxes.js";
import type * as quotas from "../quotas.js";
import type * as senderGroups from "../senderGroups.js";
import type * as ses from "../ses.js";
import type * as subscriptions from "../subscriptions.js";
import type * as unsubscribe from "../unsubscribe.js";
import type * as users from "../users.js";
import type * as warmingActions from "../warmingActions.js";
import type * as warmingSchedules from "../warmingSchedules.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  affiliates: typeof affiliates;
  apiKeyActions: typeof apiKeyActions;
  apiKeys: typeof apiKeys;
  contacts: typeof contacts;
  crons: typeof crons;
  domainActions: typeof domainActions;
  domainHealth: typeof domainHealth;
  domainHealthQueries: typeof domainHealthQueries;
  domains: typeof domains;
  emailStats: typeof emailStats;
  emailVerification: typeof emailVerification;
  emailVerificationQueries: typeof emailVerificationQueries;
  emails: typeof emails;
  http: typeof http;
  inboxPlacement: typeof inboxPlacement;
  mailboxes: typeof mailboxes;
  quotas: typeof quotas;
  senderGroups: typeof senderGroups;
  ses: typeof ses;
  subscriptions: typeof subscriptions;
  unsubscribe: typeof unsubscribe;
  users: typeof users;
  warmingActions: typeof warmingActions;
  warmingSchedules: typeof warmingSchedules;
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
