export default {
  STATUS: {
    '0': 'fail',
    '1': 'success',
    '1001': 'unauthorized',
    '1002': 'forbidden',
    '1003': 'account_disabled',
    '1004': 'account_muted',
    '1005': 'captcha_invalid',
    '1006': 'identity_invalid',
    '1007': 'credential_invalid',
    '2001': 'param_invalid',
    '2002': 'rule_rejected',
    '2003': 'too_many_requests',
    '2004': 'upload_rejected',
    '3001': 'not_found',
    '3002': 'conflict',
    '4001': 'server_error',
    '4002': 'server_unavailable'
  },
  REDIRECT: [
    { route: '/login', account: true },
    { route: '/register' },
    { route: '/forgot' }
  ]
};