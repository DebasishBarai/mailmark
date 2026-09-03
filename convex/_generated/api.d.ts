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
import type * as awsAccountActions from "../awsAccountActions.js";
import type * as awsAccounts from "../awsAccounts.js";
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
import type * as lib_awsClients from "../lib/awsClients.js";
import type * as mailboxes from "../mailboxes.js";
import type * as platformStats from "../platformStats.js";
import type * as platformWarmupAccounts from "../platformWarmupAccounts.js";
import type * as quotas from "../quotas.js";
import type * as senderGroups from "../senderGroups.js";
import type * as sequenceActions from "../sequenceActions.js";
import type * as sequenceProcessing from "../sequenceProcessing.js";
import type * as sequences from "../sequences.js";
import type * as ses from "../ses.js";
import type * as subscriptions from "../subscriptions.js";
import type * as unsubscribe from "../unsubscribe.js";
import type * as users from "../users.js";
import type * as lib_gate from "../lib/gate.js";
import type * as lib_millionVerifier from "../lib/millionVerifier.js";
import type * as lib_sendPolicy from "../lib/sendPolicy.js";
import type * as sendGate from "../sendGate.js";
import type * as sendingControls from "../sendingControls.js";
import type * as suppressions from "../suppressions.js";
import type * as verification from "../verification.js";
import type * as verificationBackfill from "../verificationBackfill.js";
import type * as verificationBackfillQueries from "../verificationBackfillQueries.js";
import type * as warmingActions from "../warmingActions.js";
import type * as warmingSchedules from "../warmingSchedules.js";
import type * as warmupContent from "../warmupContent.js";
import type * as warmupEngagement from "../warmupEngagement.js";
import type * as warmupEngine from "../warmupEngine.js";
import type * as warmupGmail from "../warmupGmail.js";
import type * as warmupPool from "../warmupPool.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  affiliates: typeof affiliates;
  apiKeyActions: typeof apiKeyActions;
  apiKeys: typeof apiKeys;
  awsAccountActions: typeof awsAccountActions;
  awsAccounts: typeof awsAccounts;
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
  "lib/awsClients": typeof lib_awsClients;
  mailboxes: typeof mailboxes;
  platformStats: typeof platformStats;
  platformWarmupAccounts: typeof platformWarmupAccounts;
  quotas: typeof quotas;
  senderGroups: typeof senderGroups;
  sequenceActions: typeof sequenceActions;
  sequenceProcessing: typeof sequenceProcessing;
  sequences: typeof sequences;
  ses: typeof ses;
  subscriptions: typeof subscriptions;
  unsubscribe: typeof unsubscribe;
  users: typeof users;
  "lib/gate": typeof lib_gate;
  "lib/millionVerifier": typeof lib_millionVerifier;
  "lib/sendPolicy": typeof lib_sendPolicy;
  sendGate: typeof sendGate;
  sendingControls: typeof sendingControls;
  suppressions: typeof suppressions;
  verification: typeof verification;
  verificationBackfill: typeof verificationBackfill;
  verificationBackfillQueries: typeof verificationBackfillQueries;
  warmingActions: typeof warmingActions;
  warmingSchedules: typeof warmingSchedules;
  warmupContent: typeof warmupContent;
  warmupEngagement: typeof warmupEngagement;
  warmupEngine: typeof warmupEngine;
  warmupGmail: typeof warmupGmail;
  warmupPool: typeof warmupPool;
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
