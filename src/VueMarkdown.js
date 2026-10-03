import { h, Comment } from 'vue'
import markdownIt from 'markdown-it'
import emoji from 'markdown-it-emoji'
import subscript from 'markdown-it-sub'
import superscript from 'markdown-it-sup'
import footnote from 'markdown-it-footnote'
import deflist from 'markdown-it-deflist'
import abbreviation from 'markdown-it-abbr'
import insert from 'markdown-it-ins'
import mark from 'markdown-it-mark'
import toc from 'markdown-it-toc-and-anchor'
import katex from 'markdown-it-katex'
import tasklists from 'markdown-it-task-lists'

function slotText(nodes) {
  return nodes.map(node => {
    if (node.type === Comment) return ''
    if (Array.isArray(node.children)) return slotText(node.children)
    return typeof node.children === 'string' ? node.children : ''
  }).join('')
}

export default {
  name: 'VueMarkdown',
  compatConfig: { MODE: 3 },
  emits: ['rendered', 'toc-rendered'],

  created() {
    this._slotSourceInitialized = false
  },

  data() {
    return {
      sourceData: this.source,
    }
  },

  props: {
    watches: {
      type: Array,
      default: () => ['source', 'show', 'toc'],
    },
    source: {
      type: String,
      default: ``,
    },
    show: {
      type: Boolean,
      default: true,
    },
    highlight: {
      type: Boolean,
      default: true
    },
    html: {
      type: Boolean,
      default: true,
    },
    xhtmlOut: {
      type: Boolean,
      default: true,
    },
    breaks: {
      type: Boolean,
      default: true,
    },
    linkify: {
      type: Boolean,
      default: true,
    },
    emoji: {
      type: Boolean,
      default: true,
    },
    typographer: {
      type: Boolean,
      default: true,
    },
    langPrefix: {
      type: String,
      default: 'language-',
    },
    quotes: {
      type: String,
      default: '“”‘’',
    },
    tableClass: {
      type: String,
      default: 'table',
    },
    taskLists: {
      type: Boolean,
      default: true
    },
    toc: {
      type: Boolean,
      default: false,
    },
    tocId: {
      type: String,
    },
    tocClass: {
      type: String,
      default: 'table-of-contents',
    },
    tocFirstLevel: {
      type: Number,
      default: 2,
    },
    tocLastLevel: {
      type: Number,
    },
    tocAnchorLink: {
      type: Boolean,
      default: true,
    },
    tocAnchorClass: {
      type: String,
      default: 'toc-anchor',
    },
    tocAnchorLinkSymbol: {
      type: String,
      default: '#',
    },
    tocAnchorLinkSpace: {
      type: Boolean,
      default: true,
    },
    tocAnchorLinkClass: {
      type: String,
      default: 'toc-anchor-link',
    },
    anchorAttributes: {
      type: Object,
      default: () => ({})
    },
    prerender: {
      type: Function,
      default: (sourceData) => { return sourceData }
    },
    postrender: {
      type: Function,
      default: (htmlData) => { return htmlData }
    }
  },

  computed: {
    tocLastLevelComputed() {
      return this.tocLastLevel > this.tocFirstLevel ? this.tocLastLevel : this.tocFirstLevel + 1
    }
  },

  render() {
    if (!this._slotSourceInitialized) {
      this._slotSourceInitialized = true
      if (this.$slots.default) this.sourceData = slotText(this.$slots.default())
    }
    const md = new markdownIt()
      .use(subscript)
      .use(superscript)
      .use(footnote)
      .use(deflist)
      .use(abbreviation)
      .use(insert)
      .use(mark)
      .use(katex, { "throwOnError": false, "errorColor": " #cc0000" })
      .use(tasklists, { enabled: this.taskLists })

    if (this.emoji) {
      md.use(emoji)
    }

    md.set({
      html: this.html,
      xhtmlOut: this.xhtmlOut,
      breaks: this.breaks,
      linkify: this.linkify,
      typographer: this.typographer,
      langPrefix: this.langPrefix,
      quotes: this.quotes,
    })
    md.renderer.rules.table_open = () => `<table class="${md.utils.escapeHtml(this.tableClass)}">\n`
    let defaultLinkRenderer = md.renderer.rules.link_open ||
      function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options)
      }
    md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
      // The TOC plugin creates plain tokens without Token prototype methods.
      const attrs = tokens[idx].attrs || (tokens[idx].attrs = [])
      Object.keys(this.anchorAttributes).forEach((attribute) => {
        let aIndex = attrs.findIndex(attr => attr[0] === attribute)
        let value = this.anchorAttributes[attribute]
        if (aIndex < 0) {
          attrs.push([attribute, value])
        } else {
          attrs[aIndex][1] = value
        }
      })
      return defaultLinkRenderer(tokens, idx, options, env, self)
    }

    if (this.toc) {
      md.use(toc, {
        tocClassName: this.tocClass,
        tocFirstLevel: this.tocFirstLevel,
        tocLastLevel: this.tocLastLevelComputed,
        anchorLink: this.tocAnchorLink,
        anchorLinkSymbol: this.tocAnchorLinkSymbol,
        anchorLinkSpace: this.tocAnchorLinkSpace,
        anchorClassName: this.tocAnchorClass,
        anchorLinkSymbolClassName: this.tocAnchorLinkClass,
        tocCallback: (tocMarkdown, tocArray, tocHtml) => {
          if (tocHtml) {
            if (typeof document !== 'undefined' && this.tocId && document.getElementById(this.tocId)) {
              document.getElementById(this.tocId).innerHTML = tocHtml
            }

            this.$emit('toc-rendered', tocHtml)
          }
        },
      })
    }

    let outHtml = this.show ?
      md.render(
        this.prerender(this.sourceData)
      ) : ''
    outHtml = this.postrender(outHtml);

    this.$emit('rendered', outHtml)
    return h('div', { innerHTML: outHtml })
  },

  beforeMount() {
    this.$watch('source', () => {
      this.sourceData = this.source
    })

    this.watches.forEach((v) => {
      this.$watch(v, () => {
        this.$forceUpdate()
      })
    })
  },
}
