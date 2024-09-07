---
title: "Props Destructure を支える技術"
emoji: "💪"
type: "tech"
topics: ["vue", "フロントエンド", "typescript"]
published: false
publication_name: comm_vue_nuxt
---

# Vue 3.5 がリリースされました

先日、Vue 3.5 がリリースされました。

https://blog.vuejs.org/posts/vue-3-5

このリリースでは、Reactivity System の最適化や、新しいコンポーザブルである `useTemplateRef`、`useId`、Custom Elements の改善など様々な変更が入りました。
詳しくは上記の公式ブログや、[同 publication のまとめ記事](https://zenn.dev/comm_vue_nuxt/articles/f63de36db51b27) などを参照してください。

# 今回のトピック

Vue 3.5 で **Props Destructure** という機能が安定版となりました。\
今回はこの Props Destructure について、機能のおさらいや経緯、実装、そしてそれらを支援する技術について解説します。

https://blog.vuejs.org/posts/vue-3-5#reactive-props-destructure