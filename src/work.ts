import * as assert from 'assert'
import { createApplication } from 'kever'
import { join } from 'path'
import { loadFiles, loadFile, getFilesPath, debounce } from './util'
const Logger = console
type genConfig = () => ConfigContext
interface ConfigContext {
  port: number
  host: string
}

process.on('message', options => {
  run(options)
})

let baseDir
let defaultConfig: ConfigContext = {
  host: '127.0.0.1',
  port: 9000
}
/**
 *
 * @param data
 */
async function run(data) {
  baseDir = process.cwd()
  const options = await initOptions(data)
  await loaderModule(options)
  const serverStatus = await runServer(defaultConfig)
  return serverStatus
}
/**
 *
 * @param options
 */
async function initOptions(options) {
  const rootDir = options.dir ? join(baseDir, options.dir) : join(baseDir, './')
  const lanType =
    options.ts || process.env.NODE_ENV === 'development' ? 'ts' : 'js'
  const configFilePath = join(rootDir, `./config/index.${lanType}`)
  // require ts-node
  if (lanType === 'ts') {
    await require('ts-node').register()
  }
  return {
    configFilePath,
    rootDir,
    lanType
  }
}
/**
 *
 * @param options
 */
async function initConfig(options) {
  const genConfig: genConfig = require(options.configFilePath).default
  let config = typeof genConfig === 'function' && genConfig()
  assert(config, 'config return value must is ConfigContext type value')
  return config
}

/**
 *
 * @param options
 */
async function loaderModule(options) {
  let config = await initConfig(options)
  config.port = config.port || 9000
  // 获取app目录路径
  const appPath = join(options.rootDir, './app')
  // 获取middleare路径
  const middlePath = join(options.rootDir, './middleware')
  // 合并config
  Object.assign(defaultConfig, config)
  // get files path
  const [appFilesPath, middleFilesPath] = await Promise.all([
    getFilesPath(appPath),
    getFilesPath(middlePath)
  ])
  // load ts/js file
  Logger.info('[kever|info]: load file...')
  await Promise.all([loadFiles(appFilesPath), loadFiles(middleFilesPath)])
  Logger.info('[kever|info]: load file done')
}

async function runServer(options) {
  const app = createApplication(options)
  app.on('error', err => {
    process.send({
      error: true,
      message: err
    })
  })
  app.listen(options.port, options.host, () => {
    process.send({
      error: false,
      message: options
    })
  })
}
