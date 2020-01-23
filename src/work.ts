import { createApplication } from 'kever'
process.on('message', options => {
  const app = createApplication(options)
  app.on('error', err => {
    process.send({
      error: 1,
      message: err
    })
  })
  app.listen(options.port, options.host, () => {
    process.send({
      error: 0,
      message: options
    })
  })
})
