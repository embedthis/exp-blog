/*
    Blog processing
 */

let blogs = {}

expansive.addLoader('blog', function(meta) {
    if (meta.blog && !blogs[meta.blog.name]) {
        /*
        if (meta.blog.enable === false) {
            print("RETURN", meta.blog.name)
            return
        } */
        let blog = blend({
            name:       'blog',
            categories: 'categories',       /* Directory for post categories */
            comments:   false,              /* Generate comments */
            csp:        false,              /* Using CSP (no inline styles) */
            latest:     true,               /* Generate latest blog post */
            home:       null,               /* Directory relative to contents */
            posts:      'posts',            /* Directory containing posts under home */
            recent:     26,                  /* Number of recent posts on the sidebar */
            releases:   false,              /* Generate release feed */
            rss:        true,               /* Generate RSS feed */
            summary:    26,                 /* Number of posts on the summary home page */
        }, meta.blog)

        blog.meta = meta
        blog.top = Uri(blog.top)
        blog.home = Path(meta.home || meta.path.relativeTo(directories.contents))

        meta.blog.name = blog.name
        meta.blog.home = blog.home
        meta.blog.top = blog.top
        meta.blog.categories = blog.categories
        meta.blog.posts = blog.posts

        /*
        meta.posts = meta.top.join(meta.posts)
        meta.categories = meta.top.join(meta.categories)
        */
        blogs[blog.name] = blog
    }
})

/*
    Watch for changes
 */
expansive.addWatcher('blog', function() {
    let directories = expansive.directories
    for each (blog in blogs) {
        let pattern = directories.contents.join(blog.home, blog.posts)
        blog.articles = directories.top.files(pattern, {
            contents: true, directories: false, relative: true
        })
        for each (post in blog.articles) {
            if (!filter(post)) {
                continue
            }
            let postRendered = getLastRendered(post)
            if (post.modified > postRendered) {
                let meta = expansive.getFileMeta(post)
                if (meta.default) {
                    continue
                }
                if (!meta.draft) {
                    expansive.modify(post, 'blog', 'file')
                }
            }
            /*
                Broken -- loops when partials are modified
            let index = blog.home.join('index.html')
            if (postRendered > getLastRendered(index)) {
                expansive.modify(index, 'blog', 'file')
            }
            */
        }
    }
})

global.renderBlogRecent = function(count) {
    //  MOB - how do we get current meta?
    let meta = expansive.currentMeta
    let blog = blogs[meta.blog.name]
    count ||= blog.recent
    write('<ul class="recent">\n')
    for each (post in blog.sequence) {
        if (post.meta.index === false) continue
        write('<li><a href="@~/' + post.meta.url + '">' + post.meta.title + '</a></li>\n')
        if (--count <= 0) {
            break
        }
    }
    write('<li><a href="' + blog.top + '/archive.html">All Posts</a></li>\n')
    write('</ul>\n')
}

global.renderBlogImage = function(url, options = {}) {
    let meta = expansive.currentMeta
    let blog = blogs[(meta.blog || {}).name] || {}
    let width = ''
    if (meta.summary) {
        if (options.summary) {
            blend(options, options.summary)
        }
    } else {
        if (options.post) {
            blend(options, options.post)
        }
    }
    let style = '', clear = '', css = ''
    if (options.lead) {
        if (meta.summary) {
            css += 'lead width-30 '
            delete options.width
            delete options.css
        } else if (!options.width) {
            css += 'width-40 '
        }
    }
    if (options.width) {
        if (blog.csp) {
            let width = parseInt(options.width / 10) * 10;
            css += 'width-' + width + ' '
        } else {
            let width = options.width
            if (parseInt(width) == width) {
                style += 'width:' + options.width + '%;'
            } else {
                style += 'width:' + options.width + ';'
            }
        }
    }
    if (options.widths) {
        let index = meta.summary ? 0 : 1
        let width = options.widths[index]
        if (blog.csp) {
            width = parseInt(width / 10) * 10;
            css += 'width-' + width + ' '
        } else {
            style += 'width:' + width + ';'
        }
    }
    if (options.style) {
        if (blog.csp) {
            trace('Warn', 'Inline styles used with CSP')
        } else {
            style += options.style + ';'
        }
    }
    if (options.clearfix || options.clear) {
        clear = 'clearfix'
    }
    if (options.css) {
        css += options.css + ' ' + clear + ' '
    } else if (clear) {
        css += 'clearfix '
    }
    if (options.caption) {
        css += 'captioned '
    }
    if (css) {
        css = 'class="' + css.trim() + '" '
    }
    if (style) {
        style = 'style="' + style.trim().trim(';') + ';" '
    }
    url = url || meta.featured
    let alt = options.alt || Uri(url).basename.trimExt()

    if (meta.summary) {
        if (options.ifpost) {
            return
        }
        write('<a href="' + meta.url.basename + '">\n')
        write('<img ' + css + style + 'src="' + url + '" alt="' + alt + '">\n')
        write('</a>\n')
    } else {
        if (options.ifsummary) {
            return
        }
        write('<img ' + css + style + 'src="' + url + '" alt="' + alt + '">\n')
    }
    if (options.caption) {
        write('<div class="caption">' + options.caption + '</div>\n')
    }
    if (options.lead) {
        write('<div class="nop"></div>')
    }
}

global.includeDoc = function(path: Path, options = {}) {
    let [fileMeta, contents] = expansive.splitMetaContents(path, path.readString())
    let subMeta = meta.clone(true)
    subMeta.layout = options.layout || 'bare-content'
    let src = expansive.renderContents(contents, subMeta)
    return src.replace(/^.*--BREAK-->/gsm, '<!--more-->')
}

/*
    Make a category page. Used for the overall 'Blog Archive' and per-category pages
 */
function makeCategories(blog, path: Path, category) {
    if (!expansive.modified.everything || blog.sequence.length == 0) {
        return
    }
    if (category) {
        expansive.directories.dist.join(blog.home, blog.categories, category).makeDir()
    }
    let title = category ? ('Category: ' + category) : 'Blog Archive'
    let contents = '<div class="categories">\n<h1>' + title + '</h1>\n'
    contents += '<table class="ui striped table" title="posts">\n<tbody>\n'

    let pastYear, pastDay, pastMonth
    for each (post in blog.sequence) {
        if (post.meta.index === false) continue
        let meta = post.meta
        let year = post.date.format('%Y')
        let month = post.date.format('%b')
        let day = post.date.format('%e')
        if (!category || meta.categories.contains(category)) {
            contents += '<tr class="post">\n'
            contents += '<td class="year one wide column">' + ((year != pastYear) ? year : '')
            contents += '<td class="date one wide column">' + ((month != pastMonth) ? month : '') + ' ' +
                         ((day != pastDay) ? day : '') + '</td>\n'
            contents += '<td class="thirteen wide column"><div class="title">' +
                        '<a href="@~/' + meta.url + '">' + meta.title + '</a></div>\n'
            contents += '<div class="posted">posted in '
            for each (category in meta.categories) {
                let cat = category.replace(/\\s/g, '%20')
                contents += '<a href="' + blog.top + '/' + blog.categories + '/' + cat
                    + '/">' + category + '</a>, '
            }
            contents = contents.slice(0, -2)
            contents += '</div></td>\n'
            contents += '</tr>\n'
        }
    }
    contents += '</tbody>\n</table>\n</div>\n'
    let home = expansive.directories.contents.join(blog.home)
    let bm = expansive.metaCache[home] || expansive.topMeta
    let meta = blend(bm.clone(), {
        layout: 'blog-categories', document: path, once: true, isDocument: true
    })
    meta.title = (category || 'All') + ' Posts'
    if (meta.blog.title) {
        meta.description = meta.title + ' for ' + meta.blog.title.split('|')[0].trim()
    } else {
        meta.description = meta.title
    }
    contents = expansive.renderContents(contents, meta)
    expansive.writeDest(contents, meta)
}

function renderPostText(post) {
    let year = post.date.format('%Y')
    let month = post.date.format('%b')
    let day = post.date.format('%e')
    let path = post.document
    let [fileMeta, article] = expansive.splitMetaContents(path, path.readString())
    let meta = expansive.blendMeta(post.meta.clone(true), fileMeta || {})
    post.meta = meta
    post.article = article
    let text = article
    let matches = text.match(/(.*)<!--more-->/sm)
    if (matches) {
        text = '<!--more-->' + matches[1]
        meta.more = true
    }
    meta.layout = post.feature ? '' : 'blog-summary'
    meta.summary = true
    meta.isDocument = true

    let text = expansive.renderContents(text, meta)
    if (text) {
        /* Rebase links from blog-page relative to home-page relative */
        let re = /(src|href|link)=['"][^'"]*['"]/g
        let result = ''
        let start = 0, end = 0
        while (match = re.exec(text, start)) {
            end = re.lastIndex - match[0].length
            result += text.slice(start, end)
            let [all,kind,ref] = match[0].match(/(src|href|link)=['"]([^\"']*)['"]/)
            let url
            try {
                if (!Uri(ref).scheme && !Uri(ref).isAbsolute) {
                    if (ref == '') {
                        ref = './'
                    }
                    url = Uri(meta.dir).join(ref).normalize.trimStart(Uri(blog.home).normalize + '/')
                } else {
                    url = ref
                }
            } catch(e) {
                url = ref
            }
            result += kind + '="' + url + '"'
            start = re.lastIndex
        }
        result += text.slice(start)
        text = result
    }
    post.text = text
    return text
}

function renderFeature(post) {
    let meta = post.meta
    let text = renderPostText(post)
    text = text.replace(/^<p>/, '')
    let def = meta.post = {
        title: meta.title
    }
    def.image = meta.featured
    if (!def.image) {
        let image = text.match(/.*src="([^"]*)"/sm)
        if (image && image[1]) {
            def.image = image[1]
        }
    }
    let matches = text.match(/.*<div class="nop"><\/div>(.*)/sm)
    if (matches) {
        def.brief = matches[1].replace(/<[^>]*>/gsm, ' ')
    } else {
        def.brief = text
    }
    if (def.brief.length > 140) {
        def.brief = def.brief.slice(0, 140) + ' ...'
    }
    meta.layout = 'blog-feature'
    return expansive.renderContents('', meta)
}

function renderRss(post) {
    let meta = post.meta
    meta.layout = 'blog-atom-entry'
    meta.isDocument = true
    return expansive.renderContents(post.article, meta)
}

function renderLatest(post) {
    let meta = post.meta
    meta.layout = 'blog-latest-entry'
    meta.isDocument = true
    let text = expansive.renderContents(post.article, meta)
    return text.replace(/<a href="/g, '<a target="_blank" href="')
}

function renderReleases(post) {
    let meta = post.meta
    meta.layout = 'blog-release-entry'
    meta.isDocument = true
    let text = expansive.renderContents(post.article, meta)
    return text.replace(/<a href="/g, '<a target="_blank" href="')
}

function renderCategories(blog) {
    makeCategories(blog, blog.home.join('archive.html'))
    for (let [category,list] in blog.cat) {
        list.sort(sortPosts)
        makeCategories(blog, blog.home.join('categories', category, 'index.html'), category)
    }
}

function renderPosts(blog) {
    let meta = blog.meta
    meta.features = []
    let count = 0
    for each (feature in meta.blog.features) {
        let post = blog.sequence.find(function(e) { return e.meta.destPath == feature})
        if (post) {
            meta.features.push(renderFeature(post))
            post.featured = true
        } else {
            print("Cannot find feature", feature)
        }
        if (count++ >= 3) {
            break
        }
    }
    let count = blog.summary || blog.recent
    let rss = meta.rss = []
    let latest, news
    let release
    let posts = meta.posts = []
    for each (post in blog.sequence) {
        let contents = renderFeature(post)
        if (!post.featured && post.meta.index !== false) {
            posts.push(contents)
        }
        if (blog.rss) {
            rss.push(renderRss(post))
        }
        if (blog.latest && !latest) {
            latest = renderLatest(post)
        }
        if (post.meta.news && !news) {
            news = renderLatest(post)
        }
        if (blog.releases && meta.release && !release) {
            release = renderRelease(post)
        }
        if (--count < 0) {
            break
        }
    }
    blog.newsContent = news
    blog.latestContent = latest
    blog.releaseContent = release
}

function renderHome(blog) {
    let path = blog.home.join('index.html.exp')
    let directories = expansive.directories
    let home = directories.contents.join(blog.home)

    let meta = blend(blog.meta.clone(), { layout: 'blog-home', document: path, isDocument: true })
    meta.title = meta.blog.title
    meta.description = meta.blog.description
    // meta.posts = posts
    let contents = expansive.renderContents('', meta)
    expansive.writeDest(contents, meta)

    if (blog.rss) {
        let path = blog.home.join('atom.xml')
        let meta = blend(blog.meta.clone(), { layout: 'blog-atom', document: path, isDocument: true })
        let contents = expansive.renderContents(meta.rss.join(''), meta)
        expansive.writeDest(contents, meta)
    }
    if (blog.latestContent) {
        let path = blog.home.join(blog.posts, 'latest.html')
        let meta = blend(blog.meta.clone(), { layout: 'blog-latest', document: path, isDocument: true })
        let contents = expansive.renderContents(blog.latestContent, meta)
        expansive.writeDest(contents, meta)
    }
    if (blog.newsContent) {
        let path = blog.home.join(blog.posts, 'news.html')
        let meta = blend(blog.meta.clone(), { layout: 'blog-news', document: path, isDocument: true })
        let contents = expansive.renderContents(blog.newsContent, meta)
        expansive.writeDest(contents, meta)
    }
    if (blog.releaseContent) {
        let path = blog.home.join(blog.posts, 'release.html')
        let meta = blend(blog.meta.clone(), { layout: 'blog-release', document: path, isDocument: true })
        let contents = expansive.renderContents(blog.releaseContent, meta)
        expansive.writeDest(contents, meta)
    }
}

function renderBlog(blog) {
    renderCategories(blog)
    renderPosts(blog)
    renderHome(blog)
}

function buildPostList(blog) {
    let sequence = blog.sequence = []
    let categories = blog.cat = {}

    for each (path in blog.articles) {
        let meta = expansive.getFileMeta(path)
        if (meta.default) {
            continue
        }
        expansive.initMeta(path, meta)
        meta = blend(blog.meta.clone(), meta)
        meta = blend({categories: [], date: Date()}, meta)
        if (meta.draft) {
            continue
        }
        let date = meta.date || Date()
        let post = {
            meta: meta,
            document: path,
            dest: meta.dest,
            date: Date(date)
        }
        if (meta.index !== false) {
            if (meta.blog.features) {
                let index = meta.blog.features.indexOf(meta.destPath.toString())
                if (index >= 0) {
                    post.feature = true
                }
            }
            for each (category in meta.categories) {
                categories[category] ||= []
                categories[category].push(post)
            }
        }
        sequence.push(post)
    }
    sequence.sort(sortPosts, -1)
}

function sortPosts(seq, i, j) {
    if (seq[i].date.time < seq[j].date.time) {
        return -1
    } else if (seq[i].date.time > seq[j].date.time) {
        return 1
    } else {
        return 0
    }
}

Expansive.load({
    services: {
        name: 'blog',

        transforms: {
            init: function(transform) {
            },

            pre: function(transform) {
                let modified = expansive.modified
                if (!modified.blog && !modified.everything && !modified.file['index.html']) {
                    transform.service.modified = false
                    return
                }
                transform.service.modified = true

                for each (blog in blogs) {
                    buildPostList(blog)
                }
            },

            post: function(transform) {
                if (expansive.filters || !transform.service.modified) {
                    return
                }
                for each (let blog in blogs) {
                    renderBlog(blog)
                }
            }
        }
    }
})
