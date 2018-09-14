Expansive.load({

    services: {
        name:  'blog',

        /*
            Directory for post categories
         */
        categories: 'categories',

        /*
            Using CSP (no inline styles)
         */
        csp: true,

        /*
            Home directory for the blog
         */
        home:  '.',

        /*
            Directory containing posts under home
         */
        posts: 'posts',

        /*
            Number of recent posts on the sidebar
         */
        recent: 5,

        /*
            Generate RSS feed
         */
        rss:   true,

        /*
            Number of posts on the summary home page
         */
        summary: 5,

        /*
            Generate latest blog post
         */
        latest:   true,

        /*
            Top URL for the blog. May be prefixed by application prefix ('/blog')
         */
        top:  '@~',
        transforms: {
            init: function(transform) {
                let service = transform.service
                for each (d in [ 'home', 'top', 'posts', 'categories' ]) {
                    service[d] = Path(service[d])
                }
                /*
                    Prepare meta data
                 */
                let tm = expansive.topMeta
                let bm = tm.blog ||= {}
                bm.home ||= service.home
                bm.top ||= Uri(service.top)
                bm.posts = bm.top.join(service.posts)
                bm.categories = bm.top.join(service.categories)

                /*
                    Watch for changes
                 */
                expansive.addWatcher('blog', function() {
                    let directories = expansive.directories
                    let service = expansive.services.blog
                    let pattern = directories.contents.join(service.home, service.posts)
                    service.articles = directories.top.files(pattern, { contents: true, directories: false, relative: true})
                    for each (post in service.articles) {
                        if (!filter(post)) {
                            continue
                        }
                        let postRendered = getLastRendered(post)
                        if (post.modified > postRendered) {
                            let meta = getFileMeta(post)
                            if (meta.default) {
                                continue
                            }
                            if (!meta.draft) {
                                expansive.modify(post, 'blog', 'file')
                            }
                        }
                        /*
                            Still not catching modifications to the partials used by the index.html and archive.html
                         */
                        let index = service.home.join('index.html')
                        if (postRendered > getLastRendered(index)) {
                            expansive.modify(index, 'blog', 'file')
                        }
                    }
                })

                global.renderBlogRecent = function(count) {
                    let service = expansive.services.blog
                    count ||= service.recent
                    write('<ul class="recent">\n')
                    for each (post in service.sequence) {
                        write('<li><a href="@~/' + post.meta.url + '">' + post.meta.title + '</a></li>\n')
                        if (--count <= 0) {
                            break
                        }
                    }
                    write('<li><a href="' + meta.blog.top + '/archive.html">All Posts</a></li>\n')
                    write('</ul>\n')
                }

                global.renderBlogImage = function(url, options = {}) {
                    let service = expansive.services.blog
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
                        if (service.csp) {
                            let width = parseInt(options.width / 10) * 10;
                            css += 'width-' + width + ' '
                        } else {
                            style += 'width:' + options.width + ';'
                        }
                    }
                    if (options.widths) {
                        let index = meta.summary ? 0 : 1
                        let width = options.widths[index]
                        if (service.csp) {
                            width = parseInt(width / 10) * 10;
                            css += 'width-' + width + ' '
                        } else {
                            style += 'width:' + width + ';'
                        }
                    }
                    if (options.style) {
                        if (service.csp) {
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
            },

            pre: function(transform) {
                let service = transform.service
                let modified = expansive.modified
                if (!modified.blog && !modified.everything && !modified.file['index.html']) {
                    service.modified = false
                    return
                }
                service.modified = true

                let categories = transform.categories = {}
                let sequence = service.sequence = []
                let directories = expansive.directories
                let home = directories.contents.join(service.home)
                let bm = expansive.metaCache[home] || expansive.topMeta
                bm.blog ||= {}
                bm.blog.author ||= {}

                /*
                    Build list of posts that we can sort
                 */
                for each (path in service.articles) {
                    let meta = getFileMeta(path)
                    if (meta.default) {
                        continue
                    }
                    expansive.initMeta(path, meta)
                    meta = blend(bm.clone(), meta)
                    meta = blend({categories: [], date: Date()}, meta)
                    if (meta.draft || meta.index === false) {
                        continue
                    }
                    let date = meta.date || Date()
                    let post = {
                        meta: meta,
                        document: path,
                        dest: meta.dest,
                        date: Date(date)
                    }
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
                    sequence.push(post)
                }
                service.sortPosts = function(seq, i, j) {
                    if (seq[i].date.time < seq[j].date.time) {
                        return -1
                    } else if (seq[i].date.time > seq[j].date.time) {
                        return 1
                    } else {
                        return 0
                    }
                }
                sequence.sort(service.sortPosts, -1)
            },

            post: function(transform) {
                let service = transform.service
                let sequence = service.sequence

                if (expansive.filters || !service.modified) {
                    return
                }

                /*
                    Make a category page. Used for the overall 'Blog Archive' and per-category pages
                 */
                function makeCategories(path: Path, category) {
                    if (!expansive.modified.everything || sequence.length == 0) {
                        return
                    }
                    if (category) {
                        directories.dist.join(service.home, service.categories, category).makeDir()
                    }
                    let title = category ? ('Category: ' + category) : 'Blog Archive'
                    let contents = '<div class="categories">\n<h1>' + title + '</h1>\n'
                    contents += '<table class="ui striped table" title="posts">\n<tbody>\n'
                    let pastYear, pastDay, pastMonth
                    for each (post in sequence) {
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
                                contents += '<a href="' + service.top + '/' + service.categories + '/' + cat
                                    + '/">' + category + '</a>, '
                            }
                            contents = contents.slice(0, -2)
                            contents += '</div></td>\n'
                            contents += '</tr>\n'
                        }
                    }
                    contents += '</tbody>\n</table>\n</div>\n'
                    let home = directories.contents.join(service.home)
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
                    contents = renderContents(contents, meta)
                    writeDest(contents, meta)
                }

                function renderPostText(post) {
                    let year = post.date.format('%Y')
                    let month = post.date.format('%b')
                    let day = post.date.format('%e')
                    let path = post.document
                    let [fileMeta, article] = splitMetaContents(path, path.readString())
                    let meta = blendMeta(post.meta.clone(true), fileMeta || {})
                    post.meta = meta
                    post.article = article
                    let text = article
                    let matches = text.match(/(.*)<!--more-->/sm)
                    if (matches) {
                        text = matches[1]
                        meta.more = true
                    }
                    meta.layout = post.feature ? '' : 'blog-summary'
                    meta.summary = true
                    meta.isDocument = true
                    let text = renderContents(text, meta)
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
                                    url = Uri(meta.dir).join(ref).normalize.trimStart(Uri(service.home).normalize + '/')
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
                    let image = text.match(/.*src="([^"]*)"/sm)
                    if (!image || !image[1]) {
                        print("Cannot extract image src", text.slice(0, 200))
                    } else {
                        def.image = image[1]
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
                    return renderContents('', meta)
                }

                function renderRss(post) {
                    let meta = post.meta
                    meta.layout = 'blog-atom-entry'
                    meta.isDocument = true
                    return renderContents(post.article, meta)
                }

                //  MOB - must only be done once
                function renderLatest(post) {
                    let meta = post.meta
                    meta.layout = 'blog-latest-entry'
                    meta.isDocument = true
                    let text = renderContents(post.article, meta)
                    return text.replace(/<a href="/g, '<a target="_blank" href="')
                }

                function renderReleases(post) {
                    let meta = post.meta
                    meta.layout = 'blog-release-entry'
                    meta.isDocument = true
                    let text = renderContents(post.article, meta)
                    return text.replace(/<a href="/g, '<a target="_blank" href="')
                }

                makeCategories(service.home.join('archive.html'))

                for (let [category,list] in transform.categories) {
                    list.sort(service.sortPosts)
                    makeCategories(service.home.join('categories', category, 'index.html'), category)
                }

                /*
                    Make the blog home page with featured articles and summaries from the top posts
                 */
                meta.features = []
                for each (feature in meta.blog.features) {
                    let post = sequence.find(function(e) { return e.meta.destPath == feature})
                    if (post) {
                        meta.features.push(renderFeature(post))
                    } else {
                        print("Cannot find feature", feature)
                    }
                }

                let count = service.summary || service.recent
                let rss = []
                let latest
                let release
                let posts = meta.posts = []
                for each (post in sequence) {
                    if (!post.feature) {
                        if (meta.blog.features) {
                            posts.push(renderFeature(post))
                        } else {
                            posts.push(renderPostText(post))
                        }
                    }
                    if (service.rss) {
                        rss.push(renderRss(post))
                    }
                    if (service.latest && !latest) {
                        latest = renderLatest(post)
                    }
                    if (service.releases && meta.release && !release) {
                        release = renderRelease(post)
                    }
                    if (--count < 0) {
                        break
                    }
                }

                //  MOB - remove modified
                assert(service.modified)
                if (service.modified) {
                    let path = service.home.join('index.html.exp')
                    let home = directories.contents.join(service.home)
                    let bm = blend(expansive.topMeta.clone(), expansive.metaCache[home] || {})

                    let meta = blend(bm.clone(), { layout: 'blog-home', document: path, isDocument: true })
                    meta.title = meta.blog.title
                    meta.description = meta.blog.description
                    meta.posts = posts
                    let contents = renderContents('', meta)
                    writeDest(contents, meta)

                    if (service.rss) {
                        let path = service.home.join('atom.xml')
                        let meta = blend(bm.clone(), { layout: 'blog-atom', document: path, isDocument: true })
                        let contents = renderContents(rss.join(''), meta)
                        writeDest(contents, meta)
                    }
                    if (service.latest) {
                        let path = service.home.join(service.posts, 'latest.html')
                        let meta = blend(bm.clone(), { layout: 'blog-latest', document: path, isDocument: true })
                        let contents = renderContents(latest, meta)
                        writeDest(contents, meta)
                    }
                    if (service.releases) {
                        let path = service.home.join(service.posts, 'release.html')
                        let meta = blend(bm.clone(), { layout: 'blog-release', document: path, isDocument: true })
                        let contents = renderContents(release, meta)
                        writeDest(contents, meta)
                    }
                }
            }
        }
    }
})
