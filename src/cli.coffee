
module.exports = ->

  require "./global"
  require "./index"

  {exit} = process
  process.exit = ->
    log.onceFlushed ->
      console.log log.color.gray.dim "Exiting..."
      exit.call process

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

  .then ->
    process.exit()
