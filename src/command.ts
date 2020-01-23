import * as parseArgv from 'yargs-parser'
import * as chokidar from 'chokidar'
import { fork, exec, ChildProcess } from 'child_process'
import { debounce } from './util'
import { join } from 'path'

const Logger = console

export class Command {
  private options: any
  private watcher: chokidar.FSWatcher
  private work: ChildProcess
  private workPid: number
  private baseDir: string
  constructor() {
    this.baseDir = process.cwd()
    this.options = parseArgv(process.argv.slice(2))
    if (this.options.watch) {
      this.initWatcher()
    }
    process.on('exit', () => {
      if (this.workPid) {
        exec(`kill -9 ${this.workPid}`, () => {
          Logger.info('[kever|info]service stopped')
        })
      }
    })
  }
  /**
   * @description 启动方法
   */
  async startCommand() {
    // 开子进程启动服务
    this.work = fork(join(__dirname, './work'), [], { stdio: 'inherit' })
    this.workPid = this.work.pid
    this.work.on('message', data => {
      if (data && data.error) {
        Logger.error(
          `[kever|error]: service startup failed. reason: ${data.message} `
        )
      } else {
        Logger.info(
          `[kever|info]: service started. address: http://${data.message.host}:${data.message.port}`
        )
        this.watcher && this.watchApplication()
      }
    })
    this.work.send(this.options)
  }
  /**
   * @description 实例化一个watch
   */
  initWatcher() {
    // 初始化 watcher
    const watchAppPath = join(this.baseDir, './src/app')
    const watchMiddlePath = join(this.baseDir, './src/middleware')
    this.watcher = chokidar.watch([watchAppPath, watchMiddlePath], {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true
    })
  }
  /**
   * @description Application development watch mode
   */
  watchApplication() {
    Logger.info('[kever|info]: files watch...')
    this.watcher.on('all', debounce(this.watchHandler.bind(this), 500))
  }
  /**
   * @description watch 监听事件处理函数
   * @param event
   * @param path
   */
  watchHandler(event, path) {
    // 文件发生变化，首先查看是否有当前模块作为其它模块的子模块，如果有先在父级模块中将当前模块删除，然后重新加载
    const targetFile = require.resolve(path)
    const cacheModule = require.cache[targetFile]
    const cacheModuleParent = cacheModule && cacheModule.parent
    if (cacheModuleParent) {
      cacheModuleParent.children.splice(
        cacheModuleParent.children.indexOf(cacheModule),
        1
      )
    }
    // 删除文件避免内存泄露，将require.cache中的targetFile删除掉
    delete require.cache[targetFile]
    exec(`kill -9 ${this.workPid}`, err => {
      if (err) {
        Logger.error(`[kever|err] ${err}`)
      }
      this.watcher = null
      this.startCommand()
    })
  }
}
