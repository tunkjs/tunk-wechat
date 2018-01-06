## tunk-wechat


tunk-wechat使tunk支持微信小程序，负责定义视图层如何 **触发Action** 及如何 **将新状态注入到视图组件**。

微信小程序整体代码风格跟vue有几分相似，我们可以将小程序提供的js-wxml-wxss代码结构看作一个视图组件，tunk担当数据服务层，tunk与微信小程序完美合体！

tunk灵活的通信机制可以有效避开状态管理的性能问题，为了提高tunk与小程序协作能力，我们也做了有针对性的优化。譬如，隐藏的页面不会被注入新状态，提供onBeforeStateChange钩子控制如何setData

----

[document](https://github.com/tunkjs/gitbook-tunkjs/blob/master/doc/plugins/tunk-wechat.md)

[tunk doc](https://github.com/tunkjs/gitbook-tunkjs)

[examples](https://github.com/tunkjs/examples)

