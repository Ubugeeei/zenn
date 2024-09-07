---
title: "Props Destructure を支える技術"
emoji: "💪"
type: "tech"
topics: ["vue", "フロントエンド", "typescript"]
published: false
publication_name: comm_vue_nuxt
---

~~みなさんこんにちは, ubugeeei です．~~\
~~最近技術発信が全くできていないな〜お前それでも Vue Team Member かよ，と思いつつ，せっかく Vue 3.5 がリリースされたのでそれに関連した機能の記事でも書こうかと思います.~~

# Vue 3.5 がリリースされました

先日，Vue 3.5 がリリースされました.

https://blog.vuejs.org/posts/vue-3-5

このリリースでは，Reactivity System の最適化や，新しいコンポーザブルである `useTemplateRef`，`useId`，Custom Elements の改善など様々な変更が入りました．
詳しくは上記の公式ブログや，[同 publication のまとめ記事](https://zenn.dev/comm_vue_nuxt/articles/f63de36db51b27) などを参照してください．

# 今回のトピック

Vue 3.5 で **Props Destructure** という機能が安定版となりました．\
今回はこの Props Destructure について，機能のおさらいや経緯，実装，そしてそれらを支援する技術について解説します．

https://blog.vuejs.org/posts/vue-3-5#reactive-props-destructure

## Props Destructure ってなんだっけ？ (おさらい)

Props Destructure は defineProps で定義された props を Destructure (分割代入) した際にリアクティビティを維持する機能です．\
これにより，いくつかの DX 改善を期待することができます．

特に，デフォルト値の設定に関して `withDefault` を使用せずに簡潔に書けるようになることは大きな進歩です.

```ts
const { count = 0, msg = "hello" } = defineProps<{
  count?: number;
  message?: string;
}>();

// count の値が変更された場合もちゃんと trigger される
const double = computed(() => count * 2);
```

::::details 以前までの書き方
```ts
const props = withDefaults(
  defineProps<{
    count?: number;
    msg?: string;
  }>(),
  {
    count: 0,
    msg: "hello",
  }
);

const double = computed(() => props.count * 2);
```
::::

## Props Destructure の実装の経緯

## RFC について

Props Destructure は RFC として始まりました．

https://github.com/vuejs/rfcs/discussions/502

とは言っても，起票者は Vue.js の作者である Evan You 氏で，元はというと以前 Evan 氏が起票していた **Reactivity Transform** という別の RFC が由来になっているものです．

https://github.com/vuejs/rfcs/discussions/369

Reactivity Transform は Reactivity に関する DX 向上を図るためのコンパイラ実装で，例としては以下のような機能が挙げられます．(一部紹介)

- `$ref` による `.value` の省略
- `$` による既存のリアクティブ変数の変換
-  **props destructure**
- `$$` による境界を超えるリアクティビティの維持

そうです．props destructure はこの中の一つで，Reactivity Transform の一部として提案されました．

## Reactivity Transform の廃止

Reactivity Transform は experimental として実装が進められていましたが，最終的には廃止されることになりました．
廃止になった理由は同 RFC の以下のコメントにまとまっています．

https://github.com/vuejs/rfcs/discussions/369#discussioncomment-5059028

廃止理由を簡単に要約すると，

- `.value` が省略されるとリアクティブな変数とそうでない変数の区別がつきにくい
- 異なるメンタルモデル間のコンテキストシフトのコストを生む
- ref で動作することを期待する外部関数は結局あるので，そこで精神的な負担を増やすことになる

と言ったものです．

この Reactivity Transform は [Vue Macros というライブラリで引き続き利用可能](https://vue-macros.dev/features/reactivity-transform.html) になっていますが，vuejs/core からは 3.3 非推奨化，3.4 では完全に削除されました．

## Props Destructure としての RFC

そんなこんなでも元々は Reactivity Transform の一部として提案されていた Props Destructure ですが，後に独立した RFC として提案されることになりました．

https://github.com/vuejs/rfcs/discussions/502

> This was part of the Reactivity Transform proposal and now split into a separate proposal of its own.
