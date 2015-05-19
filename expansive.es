Expansive.load({
    transforms: {
        name:  'blog',

        home:  '.',
        posts: 'posts',
        categories: 'categories',
        recent: 5,
        rss:   true,

        script: `
            let service = expansive.services.blog
            for each (d in [ 'home', 'posts', 'categories' ]) {
                service[d] = Path(service[d])
            }
            expansive.topMeta.blog ||= {}
            let bm = expansive.topMeta.blog
            bm.home ||= service.home
            bm.top = Uri('/' + (service.home != '.' ? service.home : ''))
            bm.posts = bm.top.join(service.posts)
            bm.categories = bm.top.join(service.categories)
            
            function blogWatcher() {
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
            }

            expansive.addWatcher('blog', blogWatcher)

            function pre(topMeta, service) {
                if (!expansive.modified.blog && !expansive.modified.everything) {
                    return
                }
                let directories = expansive.directories
                let dist = directories.dist
                let collections = expansive.control.collections

                let categories = {}
                let sequence = []

                service.sequence = sequence

                let home = directories.contents.join(service.home)

                let blogMeta = expansive.metaCache[home] || topMeta
                blogMeta.blog ||= {}
                blogMeta.blog.author ||= {}

                /*
                    Build list of posts that we can sort
                 */
                for each (path in service.articles) {
                    let meta = getFileMeta(path)
                    expansive.initMeta(path, meta)
                    meta = blend(blogMeta.clone(), meta)
                    meta = blend({categories: [], date: Date()}, meta)
                    if (meta.draft) {
                        continue
                    }
                    let date = meta.date
                    let post = {
                        meta: meta,
                        document: path,
                        dest: meta.dest,
                        date: Date(date)
                    }
                    for each (category in meta.categories) {
                        categories[category] ||= []
                        categories[category].push(post)
                    }
                    sequence.push(post)
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
                sequence.sort(sortPosts, -1)

                /*
                    Make a category page. Used for the overall 'Blog Archive' and per-category pages
                 */
                function makeCategories(path: Path, category) {
                    if (category) {
                        dist.join(service.home, service.categories, category).makeDir()
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
                                        '<a href="@~' + meta.url + '">' + meta.title + '</a></div>\n'
                            contents += '<div class="posted">posted in '
                            for each (category in meta.categories) {
                                contents += '<a href="@~' + service.home + '/' + service.categories + '/' + 
                                    category + '/">' + category + '</a>, '
                            }
                            contents = contents.slice(0, -2)
                            contents += '</div></td>\n'
                            contents += '</tr>\n'
                        }
                    }
                    contents += '</tbody>\n</table>\n</div>\n'
                    let meta = blend(blogMeta.clone(), { layout: 'blog-categories', document: path })
                    contents = renderContents(contents, meta)
                    writeDest(contents, meta)
                }

                makeCategories(service.home.join('archive.html'))

                for (let [category,list] in categories) {
                    list.sort(sortPosts)
                    makeCategories(service.home.join('categories', category, 'index.html'), category)
                }

                /*
                    Make the blog home page
                 */
                let rss = ''
                let contents = ''
                let count = service.recent
                for each (post in sequence) {
                    let year = post.date.format('%Y')
                    let month = post.date.format('%b')
                    let day = post.date.format('%e')
                    let path = post.document
                    let [fileMeta, article] = splitMetaContents(path, path.readString())
                    let meta = blendMeta(post.meta.clone(true), fileMeta || {})

                    let text = article
                    let matches = text.match(/(.*)<!--more-->/sm)
                    if (matches) {
                        text = matches[1] + '\n'
                        meta.more = true
                    }
                    meta.layout = 'blog-summary'
                    contents += renderContents(text, meta)

                    if (service.rss) {
                        meta.layout = 'blog-atom-entry'
                        rss += renderContents(article, meta)
                    }
                    if (--count <= 0) {
                        break
                    }
                }
                let path = service.home.join('index.html.exp')
                let meta = blend(blogMeta.clone(), { layout: 'blog-home', document: path })
                contents = renderContents(contents, meta)
                writeDest(contents, meta)

                if (service.rss) {
                    let path = service.home.join('atom.xml')
                    let meta = blend(blogMeta.clone(), { layout: 'blog-atom', document: path })
                    rss = renderContents(rss, meta)
                    writeDest(rss, meta)
                }
            }

            /*
                Called by the sidebar to show recent posts
             */
            public function renderBlogRecent(count) {
                let service = expansive.services.blog
                count ||= service.recent
                write('<ul class="recent">\n')
                for each (post in service.sequence) {
                    write('<li><a href="@~' + post.meta.url + '">' + post.meta.title + '</a></li>\n')
                    if (--count <= 0) {
                        break
                    }
                }
                write('<li><a href="' + meta.top + expansive.topMeta.blog.home + '/archive.html">All Posts</a></li>\n')
                write('</ul>\n')
            }
        `
    }
})
