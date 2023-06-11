---
title: "ref api (Basic Reactive System 部門スタート)"
---

# ref api のおさらい (と実装)

Vue.js には Reactivity に関する様々な api がありますが、中でも ref はあまりに有名です。  
公式ドキュメントの方でも Reactivity Core という名目で、しかも一番最初に紹介されています。  
https://vuejs.org/api/reactivity-core.html#ref

ところで、ref とはどういう API でしょうか？
公式ドキュメントによると、

> The ref object is mutable - i.e. you can assign new values to .value. It is also reactive - i.e. any read operations to .value are tracked, and write operations will trigger associated effects.

> If an object is assigned as a ref's value, the object is made deeply reactive with reactive(). This also means if the object contains nested refs, they will be deeply unwrapped.

(引用: https://vuejs.org/api/reactivity-core.html#ref)

とあります。

要するに、ref object というのは 2 つの性質を持ちます。

- value プロパティに対する get/set は track/trigger が呼ばれる
- value プロパティにオブジェクトが割り当てられた際は value プロパティの値は reactive オブジェクトになる

コードベースで説明しておくと、

```ts
const count = ref(0);
count.value++; // effect (性質 1 )

const state = ref({ count: 0 });
state.value = { count: 1 }; // effect (性質 1 )
state.value.count++; // effect (性質 2 )
```

ということです。

ref と reactive の区別がつかないうちは、`ref(0)`と`reactive({ value: 0 })` の区別をごちゃごちゃにしてしまいがちですが、上記の 2 つの性質から考えると全く意味が別だということがわかります。
ref は `{ value: x }` という reactive オブジェクトを生成するわけではありません。value に対する get/value の track/trigger は ref の実装が行い、x に当たる部分がオブジェクト の場合は reactive オブジェクトにするということです。

実装のイメージ的にはこういう感じです。

```ts
class RefImpl<T> {
  private _value: T;
  public dep?: Dep = undefined;

  get value() {
    trackRefValue(this);
  }

  set value(newVal) {
    this._value = toReactive(v);
    triggerRefValue(this);
  }
}

const toReactive = <T extends unknown>(value: T): T =>
  isObject(value) ? reactive(value) : value;
```

実際にソースコードを見ながら ref を実装してみましょう！  
色々な関数や class がりますが、とりあえず RefImpl クラスと ref 関数を中心的に読んでもらえればよいかと思います。

以下のようなソースコードが動かせるようになれば OK です！
(※注: template のコンパイラは別で ref に対応する必要があるので動きません)

```ts
import { createApp, h, ref } from "chibivue";

const app = createApp({
  setup() {
    const count = ref(0);

    return () =>
      h("div", {}, [
        h("p", {}, [`count: ${count.value}`]),
        h("button", { onClick: () => count.value++ }, ["Increment"]),
      ]);
  },
});

app.mount("#app");
```

ここまでの実装:  
https://github.com/Ubugeeei/chibivue/tree/main/books/chapter_codes/brs-1_ref_api

# shallowRef

さて、続けてどんどん ref 周りの aip を実装していきます。  
先ほど、ref の性質として「value プロパティにオブジェクトが割り当てられた際は value プロパティの値は reactive オブジェクトになる」というものを紹介しましたが、この性質を持たないのが shallowRef です。

> Unlike ref(), the inner value of a shallow ref is stored and exposed as-is, and will not be made deeply reactive. Only the .value access is reactive.

(引用: https://vuejs.org/api/reactivity-advanced.html#shallowref)

やることは非常に単純で、RefImpl の実装はそのまま使い、`toReactive`の部分をスキップします。  
ソースコードを読みながら実装していきましょう！

以下のようなソースコードが動かせるようになれば OK です！

```ts
import { createApp, h, shallowRef } from "chibivue";

const app = createApp({
  setup() {
    const state = shallowRef({ count: 0 });

    return () =>
      h("div", {}, [
        h("p", {}, [`count: ${state.value.count}`]),

        h(
          "button",
          {
            onClick: () => {
              state.value = { count: state.value.count + 1 };
            },
          },
          ["increment"]
        ),

        h(
          "button", // clickしても描画は更新されない
          {
            onClick: () => {
              state.value.count++;
            },
          },
          ["not trigger ..."]
        ),
      ]);
  },
});

app.mount("#app");
```

- triggerRef
- unRef
- toRef
- toRefs
- readonly
