
module.exports = ->

  require "./global"
  require "./index"

  timeStart = Date.now()
  {exit} = process
  process.exit = ->
    log.onceFlushed ->
      timeEnd = Date.now()
      log.moat 1
      log.gray.dim "Exiting after #{timeEnd - timeStart}ms..."
      log.moat 1
      log.flush()
      exit.call process
    return

  log.indent = 2
  log.moat 1

  minimist = require "minimist"
  options = minimist process.argv.slice 2

  command = options._.shift()

  lotus.initialize options

  .then -> lotus.runCommand command, options

  .fail (error) ->
    log.moat 1
    log.red error.stack
    log.moat 1

  .then process.exit
