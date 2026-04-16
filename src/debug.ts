import debug from 'debug'

export const log = {
  adapter: debug('tn-figueiredo:email:adapter'),
  templates: debug('tn-figueiredo:email:templates'),
  unsubscribe: debug('tn-figueiredo:email:unsubscribe'),
}
