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

# Vue 3.5.0 がリリースされました

先日，Vue 3.5.0 (Tengen Toppa Gurren Lagann) がリリースされました.

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

# Props Destructure の実装の経緯

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

RFC に書いてあるものは一部なので，もう少し細かく実際の動作を覗いてみましょう．\
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

const { count = 0 } = defineProps<{ count?: number }>();
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
    count: { type: Number, required: false, default: 0 },
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

#### Output

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

となっており，エイリアスの情報が追加されています．

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

さて，ここまでで Props Destructure についてユーザーが記述したコードがどのようなランタイムコードに変換されるかをみてきました．\
それでは，これらが実際にどのような実装によって実現されているのか，[vuejs/core](https://github.com/vuejs/core/tree/v3.5.0) のソースコードを読みながら追っていきます．

:::message
これ以降登場するソースコードやリンクはすべて [v3.5.0](https://github.com/vuejs/core/tree/v3.5.0) 時点のものになります．
:::

## 前程知識

まずは [vuejs/core](https://github.com/vuejs/core/tree/v3.5.0) と言うリポジトリのおさらいですが，これが Vue.js (v3.0 以降) の実装で，packages 配下にいくつかのパッケージがあります．\
今回見ていくのは `compiler-sfc` と言うパッケージです．ここに Single File Component のコンパイラが実装されています．

https://github.com/vuejs/core/tree/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc

多くの場合はバンドラ等のツールのプラグインやローダー (別のライブラリ) に呼び出されて使われます．\
(例えば，vite だと [vite-plugin-vue](https://github.com/vitejs/vite-plugin-vue))

そして，この実装には，`compile` と言う一つの大きな関数があるわけではなく，Single File Component を全体をパースする [`parse`](https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/parse.ts#L119) と言う関数と，各ブロックをコンパイルするための，
[`compileScript`](https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L154), [`compileTemplate`](https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileTemplate.ts#L107), [`compileStyle`](https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileStyle.ts#L71) と言う関数があります．

`parse` の結果は [`SFCDescriptor`](https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/parse.ts#L71) という SFC の情報を構造化したオブジェクトで，各ブロックのコンパイル関数はこの `SFCDescriptor` (もしくは SFCDescriptor から得た情報) を引数に取ります．

![compiler-sfc-main-functions](/images/props-destructure/compiler-sfc-main-functions.drawio.png)

## script の解析やコンパイル

今回は script に関するコンパイラをメインで読んでいくことになるので，[`compileScript`](https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L154) 周辺を読んでいきます．\
注目したいファイル/ディレクトリは [`packages/compiler-sfc/src/compileScript.ts`](https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts) と [`packages/compiler-sfc/src/script`](https://github.com/vuejs/core/tree/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script) です．

`script/` の配下にそれぞれの処理が分割されていて，compileScript の方でそれらが呼び出されています．
今回は主に，以下の 3 つの処理を追ってみます．

- [script/analyzeScriptBindings.ts](https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/analyzeScriptBindings.ts)
- [script/defineProps.ts](https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/defineProps.ts)
- [script/definePropsDestructure.ts](https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/definePropsDestructure.ts)

まずは呼び出し元である `compileScript.ts` から見ていきます．

compileScript という大きな関数があります．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L154-L157

この関数は SFCDescriptor を受け取り，コードをコンパイルします．\
Descriptor から `<script>` と `<script setup>` の情報を取り出し，それぞれの処理を行います．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L167

## メタ情報の解析

順序は行ったり来たりするのですが，まずはメタ情報の解析から見てみます．

先ほどのコードの続きを見ていくと，bindings の情報を保持するオブジェクトが見当たります．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L195-L198

そして，いくつかの binding 情報を最終的には `ctx.bindingMetadata` に格納しています．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L737-L748

この `ctx.bindingMetadata` には後ほど読む `analyzeScriptBindings` の結果も格納されているようで，全体として binding のメタ情報は全てこのオブジェクトに集約されていることが予測できます．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L724

この関数の結果としても使われているため，間違いないでしょう．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L1027

試しにこの ctx.bindingMetadata を出力しつつ以下のような SFC をコンパイルしてみると，

```vue
<script setup lang="ts">
import { computed } from "vue";

const { count: renamedProps = 0 } = defineProps<{ count?: number }>();
const double = computed(() => renamedProps * 2);
</script>

<template>
  <div>{{ renamedProps }}{{ count }}{{ double }}</div>
</template>
```

以下のような出力を得ることが出来ました．

```ts
{
  renamedProps: 'props-aliased',
  __propsAliases: { renamedProps: 'count' },
  computed: 'setup-const',
  double: 'setup-ref',
  count: 'props'
}
```

また，binding のタイプには以下のものが列挙されていることも前程知識として覚えておくと良いでしょう．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-core/src/options.ts#L109-L153

それでは実際に ctx.bindingMetadata がどのように生成されているか見ていきましょう．
大枠を見てみると，compileScript は 1.1 ~ 11 のステップで処理を行っています．

※ 一部省略

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L280

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L302

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L380

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L684

.
.
.

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L820

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L937

この中から bindingMetadata に関わる部分を見ていきます．\
さらにいうと，今回は defineProps や Props Destructure に関わる部分をのみを見ていきます．

## 1.1 walk import declarations of `<script>`

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L280

script タグの import の解析です．\
import 文ももちろん識別子のバインディングがあるので，解析して bindingMetadata に追加しています．\
ここで気をつけたいのは，これらは `<script>` の処理であり，`<script setup>` は別の処理になっている点です．

AST を操作し，import 文を探します．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L280-L300

見つけたら `registerUserImport` という関数で情報を登録します．\
この時点では `bindingMetadata` ではなく，`ctx.userImports` というオブジェクトに登録しています．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L229-L258

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L250-L258

この `ctx.userImports` は後ほど `bindingMetadata` に統合されます．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L726-L736

## 1.2 walk import declarations of `<script setup>`

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L302

先ほどの処理の `<script setup>` 版です．

`bindingMetadata` を生成する処理は同じですが，通常の script と違う点は import 文を hoist したりしている点です． (setup 関数の中には書けないので)

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L306

## 2.1 process normal `<script>` body

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L380

こちらはかなり長いですが，注目するべきところは後半に呼び出されている `walkDeclaration` です．

### walkDeclaration

少し前後しますが，walkDeclaration についてみてみましょう．(実際には 2.1 に関連しない部分もありますが，これから何度も出てくるので)

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L461-L484

変数や関数，クラスの宣言があった場合にはそれらを元に bindingMetadata に情報を追加しています．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L1052-L1059

定義された変数が `const` であるかどうか，初期値が `ref`, `computed`, `shallowRef`, `customRef`, `toRef` の呼び出しであるかどうかなど，細かく判定います．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L1063

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L1110-L1115

さらにここでポイントなのは，初期値が `defineProps`, `defineEmits`, `withDefaults` などのコンパイラマクロの呼び出してあるかどうかも判定している点です．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L1073-L1082

この段階ではまだ `BindingTypes.PROS` としてはマークされていないようです．\
(defineProps だった場合には `BindingTypes.SETUP_REACTIVE_CONST` になる)

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L1102-L1104

## 2.2 process `<script setup>` body

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L499

続いて `<script setup>` の処理です．

早速 `processDefineProps` や `processDefineEmits`, `processDefineOptions` といったなんとも香ばしい関数が並んでいます．

変数宣言についてハンドリングしている部分を見てみましょう．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L524

この辺りで `defineProps` や `defineEmits` が処理されていることがわかります．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L540-L552

今回は `defineProps` に絞って読んでいきます．\
ついては `processDefineProps` という関数を読んでいきます．

## defineProps を読む

`processDefineProps` は [script/defineProps.ts](https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/defineProps.ts) に実装されています．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/defineProps.ts#L47-L51

初っ端ですが，`node` が `defineProps` の呼び出しでなければ `processWithDefaults` に飛ばします．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/defineProps.ts#L52-L54

processWithDefaults を見てみましょう．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/defineProps.ts#L94-L98

こちらも初っ端で `withDefault` の呼び出しであるかどうかを判定し，そうでなければ false を返して終了です．\
何も処理は行われません．

それ以外の場合では withDefault の呼び出しをハンドルし，第一引数として渡される想定がされている defineProps を processDefineProps にかけます．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/defineProps.ts#L102

それでは processDefineProps に戻ります．

`defineProps` には 2 つの API があります．\
第 1 引数に Runtime Props の定義を渡す形式と，ジェネリクスに型を記載する形式の 2 つです．

まずは前者のオブジェクトを ctx に保存しておきます．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/defineProps.ts#L60

そしてそれらが存在する場合は key をとりだして bindingMetadata に `BindingTypes.PROPS` として登録します．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/defineProps.ts#L64-L69

続いて前者との重複チェックも行いつつ，後者の API の場合の定義 (型引数) も ctx に保存しておきます．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/defineProps.ts#L72-L81

続いて，`declId` がオブジェクトパターンの場合，Props Destructure として `processPropsDestructure` を呼び出します．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/defineProps.ts#L84-L86

`processPropsDestructure` は [script/definePropsDestructure.ts](https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/definePropsDestructure.ts) に実装されています．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/definePropsDestructure.ts#L26-L29

`processPropsDestructure` を見てみましょう．\
`processPropsDestructure` は，props の定義を解析する処理で，それ以外の部分で登場する props の参照書き換えの処理 (e.g. `count` を `__props.count` に書き換える) は行いません．

`declId.properties` を読み進め，デフォルト値がある場合はそれを props の定義に追加していく処理がメインです．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/definePropsDestructure.ts#L51-L52C24

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/definePropsDestructure.ts#L62-L71

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/definePropsDestructure.ts#L43

参照書き換えの処理はまた後ほど読み進めます．今はここまででおしまいです．\
`processDefineProps` に戻ります．

戻ります，と言ってもこの後は特に何もしないので，`processDefineProps` はここでおしまいです．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/defineProps.ts#L84-L92

後は，ここで完成した `ctx.propsRuntimeDecl` または `ctx.propsTypeDecl` を元にコードを生成するだけです．\
生成処理はここには書いていないので，また後で見ていきます．

## 2.2 process `<script setup>` body の続き

compileScript に戻ってきました．

defineProps や defineEmits の処理が終わった後は，2-1 の時と同じように変数や関数，クラスの宣言を探して `walkDeclaration` していきます．\
`walkDeclaration` は以前説明した通りです．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L591-L606

また，`script setup` ではこれらに加え，以下のようないくつかの特別なハンドリングが必要です．\
今回のメインテーマである Props Destructure には関係ないので，詳しくは説明しません．

- top-level await の場合に非同期コンポーネントとしてマークする\
  https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L628-L649
- export 文があった場合にエラーにする\
  https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L656-L667

以上で 2 の処理はおしまいです．

## 3 props destructure transform

続いて 3 です．ここが今回の肝です．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L684-L687

実行している関数名からも分かる通り，いよいよ Props Destructure の真髄と言ってもいいでしょう．

## propsDestructure を読む

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/definePropsDestructure.ts#L97-L100

さて，早速読んでいきましょう．
この `transformDestructuredProps` という関数は [script/definePropsDestructure.ts](https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/definePropsDestructure.ts) に実装されています．

本記事でも，

> スコープの制御もきちんとできているようで，

と触れた通り，スコープの管理が必要です．\
まずはスコープ情報を詰め込む場所です．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/definePropsDestructure.ts#L91-L95

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/definePropsDestructure.ts#L105-L107

スコープのスタックを操作する関数も見当たります．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/definePropsDestructure.ts#L118-L125

前半部分には他にもローカル関数が用意されていますが，一旦読み飛ばして必要になったら随時読んでいきます．

メインの処理はこれ以下になります．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/definePropsDestructure.ts#L232

ctx から `<script setup>` の AST を取得し，そのツリーを walk していきます．

[estree-walker](https://github.com/Rich-Harris/estree-walker) というライブラリが提供している `walk` という関数を使いながら AST を walk して最終的な成果物を作るっていくのですが，

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/definePropsDestructure.ts#L10

まずはこの walk を始めるまえに `walkScope` という関数を一度実行して現在のスコープ (ルート) にあるバインディング情報を登録していきます．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/definePropsDestructure.ts#L234-L235

`node.body` (`Statement[]`) を見て回り，識別子を生成しうる箇所を探しながら登録していきます．\
具体的には変数，関数，クラスの宣言です．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/definePropsDestructure.ts#L139-L167

これにより，currentScope として設定されているスコープに対してバインディング情報が登録されます．

この `walkScope` 関数は，`walk` 関数の中で呼び出されています．

それでは，ここからは実際に `walk` 関数で行っていることを見ていきましょう．

leave hook では大したことをやっていないので，先にこっちだけ把握しておきましょう．\
重要な部分は，AST Node の type が `/Function(?:Expression|Declaration)$|Method$/` にマッチする時または BlockStatement である時に `popScope` している点です．\
ここだけ押さえておけば問題ないでしょう．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/definePropsDestructure.ts#L293-L298

それでは，メインの enter hook の方です．

### function scopes

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/definePropsDestructure.ts#L254-L261

`/Function(?:Expression|Declaration)$|Method$/` にマッチする場合です．

`pushScope` しつつ，引数も walk して binding を登録しておきます．

### catch param

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/definePropsDestructure.ts#L263-L271

続いて catch のパラメータです．
こちらはなんとも見落としがちですが，

```ts
try {
} catch (e) {}
```

の `e` の部分です．これも忘れず登録しておきます．

### non-function block scopes

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/definePropsDestructure.ts#L274-L278

続いて block scopes です．\
function 以外のものが相当するようなので，if や for, while, try などに渡される BlockStatement などは全て対象です．

こちらは body の statement を見て周り，変数宣言や関数宣言などを見つけて binding を登録していきます．

### identifier

ここまででバインディングの登録は終わっていて，最後に Identifier に入った時にバインディング情報をもとに id を書き換えます．\
`count` などが `__props.count` に変換されるのはまさにこの時です．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/definePropsDestructure.ts#L280-L290

scope の値を見て，local 変数でなかった場合は rewriteId を実行します．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/definePropsDestructure.ts#L285-L287

rewriteId では，単純な識別子の書き換え (e.g. `x --> __props.x`) に加え， オブジェクトのショートハンドなども処理しています．(e.g. `{ prop } -> { prop: __props.prop }`)

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/definePropsDestructure.ts#L188-L217

以上で Props Destructure の **識別子の書き換え** に関する処理は終わりです．\
ここまでである程度 Props Destructure に関する処理を理解できたのではないでしょうか．

後は，これまでに得た情報をもとにコードを生成するだけです．\
後少し，その前に bindingMetadata の登録周りでやることがあるので続いてはそちらをみて行きましょう．

## 6. analyze binding metadata

もう何をやったか覚えてない方もいるかもしれませんが，ようやく戻ってきました．\
これまで，compileScript の 1-1, 1-2, 2-1, 2-2, 3 と進んで，3 については Props Destructure の処理を見ました．\
続きです．

4, 5 は一旦読み飛ばして，6 の binding metadata の解析に進みます．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L721-L722

コメントを見てみると，どうやらここで defineProps の解析結果の登録も行っているようです．

まずは `scriptAst` (setup ではない通常の script の AST) に対して `analyzeScriptBindings` を実行します．
`analyzeScriptBindings` は [script/analyzeScriptBindings.ts](https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/analyzeScriptBindings.ts) に実装されています．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/analyzeScriptBindings.ts#L15

ここで何が行われているかというと，`export default` を探して Options API からのバインディングを解析しています．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/analyzeScriptBindings.ts#L17-L23

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/analyzeScriptBindings.ts#L27

例えば，`props` オプションなどです．

`export default` されたオブジェクトに `props` という key が存在している場合は `BindingTypes.PROPS` として登録します．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/analyzeScriptBindings.ts#L42-L48

他にも，`inject` であったり，`computed`, `method`, `setup`, `data` などを解析して bindingMetadata に登録しています．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/analyzeScriptBindings.ts#L50-L98

さて，`analyzeScriptBindings` を抜けて 6 の処理の続きを見てみましょう．\
続きは簡単で，これまでに収集した `ctx.userImports` や `scriptBindings`, `setupBindings` 等を `ctx.bindingMetadata` に統合しています．

ここまでで bindingMetadata は完成です！お疲れ様でした！\
残りはコード生成を見ていきましょう！

## 8. finalize setup() argument signature

生成する setup 関数のコードのシグネチャを決めています．\
第 1 引数として受け取る props が `__props` になるのもここの仕業です．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L770

## 10. finalize default export

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L937

ここで最終的に出力するコードを組み立てています．

特に今回注目したいのは以下の部分です．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/compileScript.ts#L953-L954

ここで，props の定義コードを生成し， `runtimeOptions` (コンポーネントのオプションとして出力されるコードが格納される変数) に追加しています．

`genRuntimeProps` をみてみましょう．\
この関数は [script/defineProps.ts](https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/defineProps.ts) に定義されています．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/defineProps.ts#L132

ランタイムオブジェクトとして渡されている場合はそれをそのまま文字列にして結果とします．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/defineProps.ts#L135-L136

Destructure されている場合はそれに加え，デフォルト値を取り出し，`mergeDefaults` という関数で実行時 (ランタイム) マージするようなコードを出力します．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/defineProps.ts#L137-L154

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/runtime-core/src/apiSetupHelpers.ts#L419-L422

続いては型引数で props が定義された場合です．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/defineProps.ts#L155-L157

`extractRuntimeProps` という関数で型情報を元にランタイムオブジェクト (を表す文字列) を生成します．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/defineProps.ts#L170-L172

resolveRuntimePropsFromType という関数で props の定義データに変換していることがわかります．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/defineProps.ts#L174

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/defineProps.ts#L202-L205

やっていることは意外にも単純で，最終的には key 名，type, required の情報を持ったオブジェクトを生成しています．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/defineProps.ts#L221-L226

required に関しては，本記事でも，

> optional parameter の記述を見て required を決定するため

のように触れた通り，型情報から required を決定しています．

これらの定義データをどのように作っているのか軽くみていきましょう．

まずは resolveTypeElements という関数で型情報を解決しています．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/defineProps.ts#L207

Vue.js は 3.3.0 から defineProps などのマクロで import された type 定義を使えるようになりました．

https://blog.vuejs.org/posts/vue-3-3#imported-and-complex-types-support-in-macros

ついては，単純に型引数に渡された型のリテラルを解析するだけではなく，外部ファイルから import された型定義等も解決しなくてはなりません．\
その辺りをゴタゴタやっているのがこの辺りの処理です．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/resolveType.ts#L153-L158

解決には tsconfig で設定された alias 等も必要なため，typescript をロードして，ts の api を使用して tsconfig を読み取ったりしています．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/resolveType.ts#L820-L821

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/resolveType.ts#L826-L846

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/vue/compiler-sfc/register-ts.js

そうして解決された型情報を元に Props の定義に指定される type を推論します．

その関数が `inferRuntimeType` です．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/defineProps.ts#L210C16-L210C32

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/resolveType.ts#L1464-L1469

こちらもまた複雑ですが，型 node の type を元に推論します．\
これらの推論方法については詳しくは触れませんが，地道に分岐を書いて，要所要所で `resolveTypeReference` したり，再帰的に `inferRuntimeType` したりして頑張ります．

さて，これらの処理によって型他引数に与えられた型情報からランタイムの Props 定義オブジェクトの生成に必要な情報を得ることができるようになりました．
残りは生成です．

ここまで戻ってきました．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/defineProps.ts#L174

後は props の定義を一つ一つループで回して `genRuntimePropFromType` という関数でコードを生成するだけす．

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/defineProps.ts#L182-L188

https://github.com/vuejs/core/blob/6402b984087dd48f1a11f444a225d4ac6b2b7b9e/packages/compiler-sfc/src/script/defineProps.ts#L231-L235

# 言語ツールの支援について

# 総じて，どのように Props Destructure と向き合うのが良さそうか
