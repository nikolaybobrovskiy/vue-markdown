import VueMarkdown from './VueMarkdown'

VueMarkdown.install = app => {
  app.component('vue-markdown', VueMarkdown)
}

export default VueMarkdown
