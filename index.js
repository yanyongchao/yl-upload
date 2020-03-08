const defaltSettings = {
  url: '',
  el: document.body,
  multiple: false,
  limit: -1,
  autoUpload: true,
  accept: '*',
  headers: {},
  data: {},
  withCredentials: false
}
let uid = 1
const parseError = xhr => {
  let msg = ''
  let { responseText, responseType, status, statusText } = xhr
  if (!responseText && responseType === 'text') {
    try {
      msg = JSON.parse(responseText)
    } catch (error) {
      msg = responseText
    }
  } else {
    msg = `${status} ${statusText}`
  }

  const err = new Error(msg)
  err.status = status
  return err
}

const parseSuccess = xhr => {
  let response = xhr.responseText
  console.log(response)
  if (response) {
    try {
      return JSON.parse(response)
    } catch (error) {}
  }

  return response
}

class YlUpload {
  input = null
  settings = defaltSettings
  uploadFiles = []
  constructor(options) {
    this.settings = { ...this.settings, ...options }
    this.init()
  }
  init () {
    this.input = this.initInputElement(this.settings)
    this.settings.el.appendChild(this.input)
    this.input.addEventListener('change', this.changeHandler.bind(this))
  }
  initInputElement(settings) {
    const el = document.createElement('input')
    Object.entries({
      type: 'file',
      accept: settings.accept,
      multiple: settings.multiple,
      hidden: true
    }).forEach(([key, value]) => {
      el[key] = value
    })
    return el
  }
  chooseFile () {
    this.input.value = ''
    this.input.click()
  }
  changeHandler (e) {
    const files = e.target.files
    const ret = this.callHook('choose', files)
    if (ret !== false) {
      this.loadFiles(files)
    }
  }
  loadFiles (files) {
    if (!files) return false
    const isMultiple = this.settings.multiple
    if (isMultiple && 
        this.limit !== -1 && 
        files.length + this.uploadFiles.length > this.limit) {
      this.callHook('exceed', files)
      return false
    }
    const currentFiles = Array.from(files).map(file => {
      return {
        uid: uid++,
        rawFile: file,
        fileName: file.name,
        size: file.size,
        status: 'ready'
      }
    })
    if (isMultiple) {
      this.uploadFiles = this.uploadFiles.concat(currentFiles)
    } else {
      this.uploadFiles = currentFiles
    }
    this.callHook('change', this.uploadFiles)
    this.settings.autoUpload && this.upload()
  }
  upload (file) {
    if (!this.uploadFiles.length && !file) return
    if (file) {
      const target = this.uploadFiles.find(item => item.uid === file.uid)
      target && target.status !== 'success' && this.post(target)
    } else {
      this.uploadFiles.forEach(file => {
        file.status === 'ready' && this.post(file)
      })
    }
  }
  post (file) {
    if (!file.rawFile) return

    const { headers, data, withCredentials } = this.settings
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append('file', file.rawFile, file.fileName)

    Object.keys(data).forEach(key => {
      formData.append(key, data[key])
    })
    Object.keys(headers).forEach(key => {
      xhr.setRequestHeader(key, headers[key])
    })
    file.status = 'uploading'
    xhr.withCredentials = !!withCredentials
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        file.status = 'error'
        this.callHook('error', parseError(xhr), file, this.uploadFiles)
      } else {
        file.status = 'success'
        this.callHook('success', parseSuccess(xhr), file, this.uploadFiles)
      }
    }

    xhr.onerror = e => {
      file.status = 'error'
      this.callHook('error', parseError(xhr), file, this.uploadFiles)
    }

    xhr.upload.onprogress = e => {
      const { total, loaded } = e
      e.percent = total > 0 ? loaded / total * 100 : 0
      this.callHook('progress', e, file, this.uploadFiles)
    }

    xhr.open('post', this.settings.url, true)
    xhr.send(formData)
  }
  on(evt, cb) {
    if (evt && typeof cb === 'function') {
      this['on' + evt] = cb
    }
    return this
  }
  callHook (evt, ...args) {
    if (evt && this['on' + evt]) {
      return this['on' + evt].apply(this, args)
    }
  }
}
