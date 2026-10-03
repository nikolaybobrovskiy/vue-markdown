const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const { JSDOM } = require('jsdom')
const { transformSync } = require('@babel/core')

const dom = new JSDOM('<!doctype html><div id="app"></div><div id="toc"></div>')
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Node']) {
  global[key] = dom.window[key]
}
const vue = require(process.env.VUE_RUNTIME || 'vue')
if (vue.configureCompat) vue.configureCompat({ MODE: 3 })
require.cache[require.resolve('vue')] = { exports: vue }
const filename = path.resolve(__dirname, '../src/VueMarkdown.js')
const componentModule = new Module(filename, module)
componentModule.filename = filename
componentModule.paths = Module._nodeModulePaths(path.dirname(filename))
componentModule._compile(transformSync(fs.readFileSync(filename, 'utf8'), {
  babelrc: false, configFile: false,
  plugins: ['@babel/plugin-transform-modules-commonjs']
}).code, filename)
const Component = componentModule.exports.default
require.cache[filename] = componentModule
const entryFilename = path.resolve(__dirname, '../src/index.js')
const entryModule = new Module(entryFilename, module)
entryModule.filename = entryFilename
entryModule.paths = componentModule.paths
entryModule._compile(transformSync(fs.readFileSync(entryFilename, 'utf8'), {
  babelrc: false, configFile: false,
  plugins: ['@babel/plugin-transform-modules-commonjs']
}).code, entryFilename)

async function run() {
  const errors = []
  const warnings = []
  const events = []
  const tocEvents = []
  const state = vue.reactive({ source: '**initial**', show: true, toc: false })
  const app = vue.createApp({
    render() {
      return vue.h(Component, {
        ...state,
        id: 'viewer', class: 'markdown-viewer',
        anchorAttributes: { target: '_blank', rel: 'noopener noreferrer' },
        tocId: 'toc',
        onRendered: html => events.push(html),
        onTocRendered: html => tocEvents.push(html)
      })
    }
  })
  app.config.errorHandler = error => errors.push(error)
  app.config.warnHandler = warning => warnings.push(warning)
  app.use(entryModule.exports.default)
  assert.equal(app.component('vue-markdown'), Component)
  app.mount('#app')
  assert.deepEqual(errors, [], 'component mounts without Vue 2 render errors')
  assert.equal(document.querySelector('#viewer strong')?.textContent, 'initial')
  state.source = '[link](https://example.com) :smile: H~2~O x^2^ ++insert++ ==mark==\n\n- [x] task\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n$E=mc^2$'
  await vue.nextTick()
  assert.equal(document.querySelector('#viewer a').target, '_blank')
  assert.equal(document.querySelector('#viewer sub').textContent, '2')
  assert.equal(document.querySelector('#viewer sup').textContent, '2')
  assert.ok(document.querySelector('#viewer ins'))
  assert.ok(document.querySelector('#viewer mark'))
  assert.ok(document.querySelector('#viewer input[type=checkbox]'))
  assert.ok(document.querySelector('#viewer table.table'))
  assert.ok(document.querySelector('#viewer .katex'))
  assert.ok(document.querySelector('#viewer').textContent.includes('😄'))
  state.toc = true
  state.source = '## Heading\n\n@[toc]'
  await vue.nextTick()
  assert.ok(document.querySelector('#toc').innerHTML.includes('Heading'))
  assert.ok(tocEvents.at(-1).includes('Heading'))
  state.show = false
  await vue.nextTick()
  assert.equal(document.querySelector('#viewer').innerHTML, '')
  assert.equal(events.at(-1), '')
  assert.deepEqual(errors, [])
  assert.deepEqual(warnings, [])
  app.unmount()

  const slotState = vue.reactive({ text: '**slot**', source: 'ignored' })
  let prerenderCalls = 0
  const slotApp = vue.createApp({
    render() {
      return vue.h(Component, {
        source: slotState.source,
        prerender: source => { prerenderCalls++; return source + '!' },
        postrender: html => html + '<span>postrender</span>'
      }, {
        default: () => [vue.h(vue.Fragment, [
          vue.createCommentVNode('ignored'),
          vue.createTextVNode(slotState.text)
        ])]
      })
    }
  })
  slotApp.config.errorHandler = error => errors.push(error)
  slotApp.config.warnHandler = warning => warnings.push(warning)
  slotApp.mount('#app')
  assert.equal(document.querySelector('#app strong').textContent, 'slot')
  assert.equal(document.querySelector('#app span').textContent, 'postrender')
  slotState.text = '**changed slot**'
  await vue.nextTick()
  assert.equal(document.querySelector('#app strong').textContent, 'slot', 'slot is an initial snapshot')
  const callsBeforeUpdate = prerenderCalls
  slotState.source = '**updated source**'
  await vue.nextTick()
  assert.equal(document.querySelector('#app strong').textContent, 'updated source')
  assert.ok(!document.querySelector('#app').textContent.includes('!!'), 'prerender is not applied twice')
  assert.ok(prerenderCalls > callsBeforeUpdate)
  assert.deepEqual(errors, [])
  assert.deepEqual(warnings, [])
  slotApp.unmount()
  console.log(`PASS: ${process.env.VUE_RUNTIME || 'vue'} source updates, plugins, TOC, show, events, attrs, fragment slots, render hooks`)
}
run().catch(error => { console.error(error); process.exitCode = 1 })
