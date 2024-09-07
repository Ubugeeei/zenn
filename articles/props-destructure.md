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
- **props destructure**
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

そんなこんなでも元々は Reactivity Transform の一部として提案されていた Props Destructure ですが，後に独立した RFC として 2023/4 に提案されることになりました．

https://github.com/vuejs/rfcs/discussions/502

> This was part of the Reactivity Transform proposal and now split into a separate proposal of its own.

RFC にもあるように，モチベーションは主に 2 点です．

- デフォルト値とエイリアスのための簡潔な構文
- template での暗黙的な props アクセスとの一貫性

詳細は後で書きますが，概ね以下のようにコンパイルされることが RFC にも記載されています．

> ### Compilation Rules
>
> The compilation logic is straightforward - the above example is compiled like the following:
>
> #### Input
>
> ```ts
> const { count } = defineProps(["count"]);
>
> watchEffect(() => {
>   console.log(count);
> });
> ```
>
> #### Output
>
> ```ts
> const __props = defineProps(["count"]);
>
> watchEffect(() => {
>   console.log(__props.count);
> });
> ```

ユーザーが書くソースコードとしては destructuring されたプロパティを扱うことになりますが，コンパイラはこれらの変数を追跡して従来通りの props オブジェクトから辿る形でアクセスするコードに変換し，リアクティビティを維持します．

そして，この機能における欠点も [同コメント](https://github.com/vuejs/rfcs/discussions/502#discussion-5140019) に記載されています．\
以下にいくつかまとめると，

- destructuring された props を誤って関数に渡してしまい，リアクティビティが失われる可能性がある
- props であることが明示的でない (他の変数と区別がつかなくなる)
- コンパイラマジックによる初学者の混乱

と言った感じで詳しくは RFC を参照して欲しいですが，大きく上記のような欠点が挙げられており，**この欠点に対する向き合い方** も同時に記載されています．\
向き合い方に関してはざっくり「**別に，今までもそうだったけどたいして問題か？**」と言った感じです．

# Props Destructure はどのように動作するか

RFC に書いてあるものは一部なので，もう少し細かく実際の動作を除いてみましょう．\
実装方法については後で詳しく触れますが，まず前提として Props Destructure は **コンパイラの実装** です.\
コンパイラがなんなのか，という話については [同 publication のこちらの記事](https://zenn.dev/comm_vue_nuxt/articles/what-is-vue-compiler) を是非参照してください．

ついては「動作を見る」と言いまいしたが，正確には「どのようにコンパイルされるか見る」ということになります．

:::message
※ 全ての出力コードに関して:

- コードはフォーマットをかけています．
- コンパイラのモードは Development Mode です．\
  Production Mode では，props に関する一部のオプション (validator, required) が削除されてしまい分かりづらいため，今回は Development Mode での出力を見ていきます．
- コンパイラのバージョンは Vue 3.5.0 です．
  :::

### 基本動作 (Props Destructure 以前)

まずは，Props Destructure を利用しない場合の基本的な動作です．\
せっかくなので，定義した props を template 内で利用することも一緒に見てみます．

#### Input

```vue
<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ count: number }>();
const double = computed(() => props.count * 2);
</script>

<template>
  <div>{{ props.count }}{{ count }}{{ double }}</div>
</template>
```

##### Output

```ts
/* Analyzed bindings: {
  "computed": "setup-const",
  "props": "setup-reactive-const",
  "double": "setup-ref",
  "count": "props"
} */
import { defineComponent as _defineComponent } from "vue";
import { computed } from "vue";

const __sfc__ = /*#__PURE__*/ _defineComponent({
  __name: "App",
  props: {
    count: { type: Number, required: true },
  },
  setup(__props, { expose: __expose }) {
    __expose();

    const props = __props;
    const double = computed(() => props.count * 2);

    const __returned__ = { props, double };
    Object.defineProperty(__returned__, "__isScriptSetup", {
      enumerable: false,
      value: true,
    });
    return __returned__;
  },
});

import {
  toDisplayString as _toDisplayString,
  openBlock as _openBlock,
  createElementBlock as _createElementBlock,
} from "vue";

function render(_ctx, _cache, $props, $setup, $data, $options) {
  return (
    _openBlock(),
    _createElementBlock(
      "div",
      null,
      _toDisplayString($setup.props.count) +
        _toDisplayString($props.count) +
        _toDisplayString($setup.double),
      1 /* TEXT */
    )
  );
}
__sfc__.render = render;
__sfc__.__file = "src/App.vue";
export default __sfc__;
```

#### props オブジェクトの名前

まず，setup 関数の第一引数として受け取る props は `__props` という名前に固定されていて，\
ユーザー定義の props オブジェクト名はこれをバインドしていることがわかります．

```ts
const props = defineProps();
```

と書いた場合には，

```ts
const props = __props;
```

になりますし，

```ts
const mySuperAwesomeProps = defineProps();
```

と書いた場合には，

```ts
const mySuperAwesomeProps = __props;
```

になります．

#### props の定義

Vue.js では props の定義はコンポーネントの props オプションで行われます．
今回で言うと，

```ts
const __sfc__ = /*#__PURE__*/ _defineComponent({
  props: {
    count: { type: Number, required: true },
  },
});
```

の部分です．

Input の `defineProps<{ count: number }>()` の部分がコンパイラによって `props: { count: { type: Number, required: true } }` に変換されていることがわかります．

もしここで，`defineProps<{ count?: string }>()` と書いた場合は，`props: { count: { type: String, required: false } }` になります．\
また，ここで注意したい点は，Vue.js のコンパイラは型情報ではなく，optional parameter の記述を見て required を決定するため，`defineProps<{ count: string | undefined }>()` と書いても `required` は `false` になりません．

#### 参照元

続いては template に関してです．
今回の Input の例では

```vue
<template>
  <div>{{ props.count }}{{ count }}{{ double }}</div>
</template>
```

となっていますが，props, count, double はそれぞれどのように参照されているか見てみましょう．\
Vue.js では props として定義された変数は template でそのまま参照することができます．(like `{{ count }}`)
もちろん，script setup 内で props オブジェクトとして名前をつけたものも参照できます． (like `{{ props.count }}`)

コンパイル結果をみてみると，上部に解析結果があります．

```ts
/* Analyzed bindings: {
  "computed": "setup-const",
  "props": "setup-reactive-const",
  "double": "setup-ref",
  "count": "props"
} */
```

`computed` も解析されてしまっているのは置いておいて，`props`, `double`, `count` に注目してみてください．\
それぞれ，`setup-reactive-const`, `setup-ref`, `props` というバインディングがついています．

このメタデータを元に template 内での変数の参照を解決していることがわかります．\
実際にどう解決されているかというと，

```ts
function render(_ctx, _cache, $props, $setup, $data, $options) {
  return (
    _openBlock(),
    _createElementBlock(
      "div",
      null,
      _toDisplayString($setup.props.count) +
        _toDisplayString($props.count) +
        _toDisplayString($setup.double),
      1 /* TEXT */
    )
  );
}
```

の部分です．

template 内に登場する識別子のバインディング情報が `setup-xxx` の場合には `$setup` から，props の場合には `$props` から参照されているようにコンパイルします．

### Props Destructure の基本動作

さて，ここから今回の本題である Props Destructure の動作についてみていきます．\
まずはシンプルな例から見ていきましょう．

#### Input

```vue
<script setup lang="ts">
import { computed } from "vue";

const { count } = defineProps<{ count: number }>();
const double = computed(() => count * 2);
</script>

<template>
  <div>{{ count }}{{ double }}</div>
</template>
```

#### Output

```ts
/* Analyzed bindings: {
  "computed": "setup-const",
  "double": "setup-ref",
  "count": "props"
} */
import { defineComponent as _defineComponent } from "vue";
import { computed } from "vue";

const __sfc__ = /*#__PURE__*/ _defineComponent({
  __name: "App",
  props: {
    count: { type: Number, required: true },
  },
  setup(__props, { expose: __expose }) {
    __expose();

    const double = computed(() => __props.count * 2);

    const __returned__ = { double };
    Object.defineProperty(__returned__, "__isScriptSetup", {
      enumerable: false,
      value: true,
    });
    return __returned__;
  },
});

import {
  toDisplayString as _toDisplayString,
  openBlock as _openBlock,
  createElementBlock as _createElementBlock,
} from "vue";

function render(_ctx, _cache, $props, $setup, $data, $options) {
  return (
    _openBlock(),
    _createElementBlock(
      "div",
      null,
      _toDisplayString($props.count) + _toDisplayString($setup.double),
      1 /* TEXT */
    )
  );
}
__sfc__.render = render;
__sfc__.__file = "src/App.vue";
export default __sfc__;
```

Destructuring してしまっているので，前回のテンプレートから `{{ props.count }}` は削除してしまいました (props と言う名前の変数は存在しないため)．

まず注目したいのはコンパイル結果の

```ts
const double = computed(() => __props.count * 2);
```

の部分です．こちらは RFC にも記載がありました．\
実際にユーザーが書いたコードは `const double = computed(() => count * 2);` ですが，メタデータによって `count` が `props` であることはわかっているので，`__props.count` としてコンパイルされています．\
この挙動は template 内で count を動作させる際とほとんど同様です．

RFC にもあった

> template での暗黙的な props アクセスとの一貫性

の部分も伺えます．

スコープの制御もきちんとできているようで，

```ts
import { computed } from "vue";

const { count } = defineProps<{ count: number }>();
const double = computed(() => count * 2);

{
  const count = 1;
  console.log(count);
}
```

と書いた場合には，

```ts
const double = computed(() => __props.count * 2);

{
  const count = 1;
  console.log(count);
}
```

と言うコードが生成されます．

### デフォルト値の設定

続いてデフォルト値の設定です．出力コードはみなさんすでに予想できていると思います．

#### Input

```vue
<script setup lang="ts">
import { computed } from "vue";

const { count = 0 } = defineProps<{ count: number }>();
const double = computed(() => count * 2);
</script>

<template>
  <div>{{ count }}{{ double }}</div>
</template>
```

#### Output

```ts
/* Analyzed bindings: {
  "computed": "setup-const",
  "double": "setup-ref",
  "count": "props"
} */
import { defineComponent as _defineComponent } from "vue";
import { computed } from "vue";

const __sfc__ = /*#__PURE__*/ _defineComponent({
  __name: "App",
  props: {
    count: { type: Number, required: true, default: 0 },
  },
  setup(__props, { expose: __expose }) {
    __expose();

    const double = computed(() => __props.count * 2);

    const __returned__ = { double };
    Object.defineProperty(__returned__, "__isScriptSetup", {
      enumerable: false,
      value: true,
    });
    return __returned__;
  },
});

import {
  toDisplayString as _toDisplayString,
  openBlock as _openBlock,
  createElementBlock as _createElementBlock,
} from "vue";

function render(_ctx, _cache, $props, $setup, $data, $options) {
  return (
    _openBlock(),
    _createElementBlock(
      "div",
      null,
      _toDisplayString($props.count) + _toDisplayString($setup.double),
      1 /* TEXT */
    )
  );
}
__sfc__.render = render;
__sfc__.__file = "src/App.vue";
export default __sfc__;
```

`count: { type: Number, required: true, default: 0 },` を観測することができました．

### props のエイリアス

Props Destructure では通常の JavaScript の分割代入のように，変数名にエイリアスを与えることができます．
こちらも，どのようなコンパイル結果になるか除いてみましょう．

#### Input

```vue
<script setup lang="ts">
import { computed } from "vue";

const { count: renamedPropsCount } = defineProps<{ count: number }>();
const double = computed(() => renamedPropsCount * 2);
</script>

<template>
  <div>{{ count }}{{ renamedPropsCount }}{{ double }}</div>
</template>
```

### Output

```ts
/* Analyzed bindings: {
  "renamedPropsCount": "props-aliased",
  "__propsAliases": {
    "renamedPropsCount": "count"
  },
  "computed": "setup-const",
  "double": "setup-ref",
  "count": "props"
} */
import { defineComponent as _defineComponent } from "vue";
import { computed } from "vue";

const __sfc__ = /*#__PURE__*/ _defineComponent({
  __name: "App",
  props: {
    count: { type: Number, required: true },
  },
  setup(__props, { expose: __expose }) {
    __expose();

    const double = computed(() => __props.count * 2);

    const __returned__ = { double };
    Object.defineProperty(__returned__, "__isScriptSetup", {
      enumerable: false,
      value: true,
    });
    return __returned__;
  },
});

import {
  toDisplayString as _toDisplayString,
  openBlock as _openBlock,
  createElementBlock as _createElementBlock,
} from "vue";

function render(_ctx, _cache, $props, $setup, $data, $options) {
  return (
    _openBlock(),
    _createElementBlock(
      "div",
      null,
      _toDisplayString($props.count) +
        _toDisplayString($props["count"]) +
        _toDisplayString($setup.double),
      1 /* TEXT */
    )
  );
}
__sfc__.render = render;
__sfc__.__file = "src/App.vue";
export default __sfc__;
```

まず，注目したいところは上部の解析結果です．

```ts
/* Analyzed bindings: {
  "renamedPropsCount": "props-aliased",
  "__propsAliases": {
    "renamedPropsCount": "count"
  },
  "computed": "setup-const",
  "double": "setup-ref",
  "count": "props"
} */
```

となっていおり，エイリアスの情報が追加されています．

`__propsAliases` にエイリアスと元の変数名の対応が記載されており，`renamedPropsCount` も `props-alised` という解析結果になっています．\
この情報を元にコンパイラは，`renamedPropsCount` を `__props.count` としてコンパイルしています．

```ts
const double = computed(() => __props.count * 2);
```

```ts
_toDisplayString($props.count) +
  _toDisplayString($props["count"]) +
  _toDisplayString($setup.double);
```

# Props Destructure はどのように実装されているか

# 言語ツールの支援について

# 総じて，どのように Props Destructure と向き合うのが良さそうか
