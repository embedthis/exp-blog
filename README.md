exp-blog
===

Expansive plugin for blogs.

## Overview

The exp-blog plugin provides a framework for blogging.

## Installation

    pak install exp-blog

The blog service manages blog posts written using Markdown and generates a blog home page, blog categories, archive and
RSS feeds.

### Configuration

* categories &mdash; Directory under 'dist' to contain the blog post category indexes.
* csp &mdash; Generate content suitable for use with Content Security Protocol. This means no inline scripts or styles.
    Defaults to true.
* enable &mdash; Enable the blogging service. Default to true.
* home &mdash; Home directory for the blog. Defaults to '.'
* posts &mdash; Directory under 'contents' containing blog posts. Defaults to 'posts'.
* recent &mdash; Number of recent posts to put on the home page. Defaults to 5.
* rss &mdash; Generate an Atom / RSS feed. Defaults to true.
* top &mdash; Top URL for the blog. Defaults to '@~'

## Creating Posts

Posts are created as [Markdown](https://daringfireball.net/projects/markdown/) files under the contents/posts directory.  You can copy the sample post contents/posts/first-post.html.md to get you started. This is currently configured as a draft post. Set draft to false to see the post. You can create subdirectories under the contents/posts directory using any directory structure.

Posts have a section of meta data at the top of the Markdown file between braces **{}**. The meta data defines the post layout, title, date, post categories and draft status. Post categories are any strings that help to classify your posts. There are two special directives that help format your post. The \<!--more--> string marks the end of a leading summary portion that is used on the blog home page. The \<!--clear--> string may be used to clear the HTML floating of text around images.

## Blog Meta Data

The blog service supports additional meta data fields.

* draft &mdash; If true, the post is in draft form and will not be rendered. Defaults to false.
* date &mdash; Date the post was written. Use the form: 'YYYY-MM-DD MM:SS' using a 24-hour clock. Defaults to now.
* categories &mdash; Array of blog categories. Categories are arbitrary strings.
* title &mdash; Title of the post. This is used in the HTML page title.

## API

### renderBlogImage

    renderBlogImage(url, options)

#### Options

* alt &mdash; Alternate text to use with the image. Default to the image basename.
* clearfix &mdash; Clear the packing of the current HTML element. Defaults to false.
* css &mdash; CSS selector to use in styling the image. Defaults to none.
* lead &mdash; If true, the image is regarded as a post lead image. The image is formatted at 50% width and the text is right aligned around the image. Defaults to false.
* ifpost &mdash; If true, the image appears on the post page itself. Defaults to true.
* ifsummary &mdash; If true, the image appears on the blog summary page. Defaults to true.
* post &mdash; Hash of options to apply only on the post page. Defaults to none.
* style &mdash; Inline styles to use in styling the image. Defaults to none.
* summary &mdash; Hash of options to apploy only on the blog summary page.
* width &mdash; Width of the image. This is converted into a CSS style of the form: 'width-NN' where NN is the width
    rounded down to the nearest power of 10. Default is none.

## Get Pak

[https://embedthis.com/pak/](https://embedthis.com/pak/)
