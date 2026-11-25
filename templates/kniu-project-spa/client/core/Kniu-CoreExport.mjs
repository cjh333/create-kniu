export * as Contracts from './Kniu-Contracts.mjs';
export * as MVVM from './Kniu-MVVM.mjs';
export * as Request from './Kniu-Request.mjs';
export * as WorkerRequest from './Kniu-WorkerRequest.mjs';
export * as Router from './Kniu-Router.mjs';
export * as Util from './Kniu-Util.mjs';
export * as TemplateEngine from './Kniu-TemplateEngine.mjs';
export * as Sanitizer from './Kniu-Sanitizer.mjs';
export * as A11y from './Kniu-A11y.mjs';
export * as ControllerKit from './Kniu-ControllerKit.mjs';
export * as AuthSession from './Kniu-AuthSession.mjs';
export * as Auth from './Kniu-Auth.mjs';
export * as AuthService from './Kniu-AuthService.mjs';
export * as Identity from './Kniu-Identity.mjs';
export * as IdentityService from './Kniu-IdentityService.mjs';
export * as Store from './Kniu-Store.mjs';
export * as Async from './Kniu-Async.mjs';
export * as Code from './Kniu-Code.mjs';
export * as Icons from './Kniu-Icons.mjs';
export * as Shadow from './Kniu-Shadow.mjs';
export * as Proxy from './Kniu-Proxy.mjs';
export * as Head from './Kniu-Head.mjs';
export * as Errors from './Kniu-Error.mjs';
export * as Observability from './Kniu-Observability.mjs';
export * as Protocol from './Kniu-Protocol.mjs';
export * as ServiceWorker from './Kniu-ServiceWorker.mjs';
export * as ComponentLoader from './Kniu-ComponentLoader.mjs';
export * as DefaultAvatar from './Kniu-DefaultAvatar.mjs';
export {
  configureContracts, getContracts, resetContracts, DEFAULT_CONTRACTS,
  isSuccessResponse, responseMessage, responseData, responseRecords,
  failureResult, paginationRequest, readPagination, translatedText,
  isAdminUser, isSuperUser, applyContractNavFlags, loginRedirectHash
} from './Kniu-Contracts.mjs';
export { createRequest, REQUEST } from './Kniu-Request.mjs';
export { createRouter } from './Kniu-Router.mjs';
export {
  configureControllerKit, createControllerKit, safePost, createRequestActions
} from './Kniu-ControllerKit.mjs';

export const VERSION = '1.0.0';

export async function createBrowserClient(options = {}) {
  const { createClient } = await import('./Kniu-Client.mjs');
  return createClient(options);
}