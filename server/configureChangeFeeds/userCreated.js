/* eslint-disable no-console, camelcase */
import processChangeFeedWithAutoReconnect from 'rethinkdb-changefeed-reconnect'

import {connect} from 'src/db'
import {USER_ROLES} from 'src/common/models/user'
import handleConnectionError from './util/handleConnectionError'

const r = connect()

export default function userCreated(queueService) {
  processChangeFeedWithAutoReconnect(
    _getFeed,
    _getFeedProcessor(queueService),
    handleConnectionError,
    {changefeedName: 'user created'}
  )
}

function _getFeed() {
  return r.table('users')
    .getAll(USER_ROLES.LEARNER, {index: 'roles'})
    .changes()
    .filter(r.row('old_val').eq(null))
}

function _getFeedProcessor(queueService) {
  const userCreatedQueue = queueService.getQueue('userCreated')
  const userInviteCodeUsedQueue = queueService.getQueue('userInviteCodeUsed')
  return ({new_val: user}) => {
    const jobOpts = {
      attempts: 2,
      backoff: {type: 'fixed', delay: 60000},
    }
    userCreatedQueue.add(user, jobOpts)
    userInviteCodeUsedQueue.add(user, jobOpts)
  }
}
