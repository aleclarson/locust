
module.exports = ->

  require "./global"
  require "./index"

  log.indent = 2
  log.moat 1

  minimist = require "minimist"
  options = minimist process.argv.slice 2

  command = options._.shift()

  lotus.initialize options

  .then -> lotus.runCommand command, options

  .always (error) ->

    if error
      log.moat 1
      log.red error.constructor.name, ": "
      log.white error.message
      log.moat 0
      log.gray.dim error.stack.split(log.ln).slice(1).join(log.ln)
      log.moat 1

    log.cursor.isHidden = no
    process.exit()
