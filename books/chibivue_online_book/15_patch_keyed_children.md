---
title: "key属性とパッチレンダリング(Basic Virtual DOM部門スタート)"
---

# 重大なバグ

実は今の chibivue のパッチレンダリングには重大なバグが存在しています。  
パッチレンダリングの実装をした際に、

> patchChildren に関して、本来は key 属性などを付与して動的な長さの子要素に対応したりしないといけない

と言ったのを覚えているでしょうか。

実際にどのような問題が起こるのか確かめてみましょう。
現時点での実装だと、patchChildren は以下のような実装になっています。

```ts
const patchChildren = (n1: VNode, n2: VNode, container: RendererElement) => {
  const c1 = n1.children as VNode[];
  const c2 = n2.children as VNode[];

  for (let i = 0; i < c2.length; i++) {
    const child = (c2[i] = normalizeVNode(c2[i]));
    patch(c1[i], child, container);
  }
};
```

これは、c2(つまり次の vnode)の長さを基準にループを回しています。
つまり、c1 と c2 が同じようのの場合にしか基本的には成り立っていないのです。

![c1c2map](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/books/images/c1c2map.png)

例えば、要素が減っていた場合を考えてみましょう。
patch のループは c2 を基本としているわけなので、4 つめの要素の patch が行われません。

![c1c2map_deleted](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/books/images/c1c2map_deleted.png)

このようになった時、どうなるかというと、単純に 1~3 つ目の要素は更新され、4 つ目は消えずの c1 のものが残ってしまいます。

実際に動作を見てみましょう。

```ts
import { createApp, h, reactive } from "chibivue";

const app = createApp({
  setup() {
    const state = reactive({ list: ["a", "b", "c", "d"] });
    const updateList = () => {
      state.list = ["e", "f", "g"];
    };

    return () =>
      h("div", { id: "app" }, [
        h(
          "ul",
          {},
          state.list.map((item) => h("li", {}, [item]))
        ),
        h("button", { onClick: updateList }, ["update"]),
      ]);
  },
});

app.mount("#app");
```

update ボタンを押すと以下のようになるかと思います。

![patch_bug](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/books/images/patch_bug.png)

list は`["e", "f", "g"]`に更新したはずなのに、`d`が残ってしまっています。

そして、実は問題はこれだけではありません。要素が差し込まれた時のことを考えてみましょう。
現状では、c2 を基準にループを回しているだけなので、以下のようになってしまいます。

![c1c2map_inserted](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/books/images/c1c2map_inserted.png)

しかし、実際に差し込まれたのは`new element`で、比較は c1,c2 のそれぞれの li 1, li 2, li 3, li 4 同士で行いたいはずです。

![c1c2map_inserted_correct](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/books/images/c1c2map_inserted_correct.png)

これらの二つの問題に共通して言えることは、「c1 と c2 で同一視したい node が判断できない」ということです。  
これを解決するには、要素に key を付与し、その key を元にパッチを行う必要があります。  
ここで、Vue のドキュメントで key 属性についての説明を見てみましょう。

> 特別な属性 key は、主に Vue の仮想 DOM アルゴリズムが新しいノードリストを古いリストに対して差分する際に、vnode を識別するためのヒントとして使用されます。

https://ja.vuejs.org/api/built-in-special-attributes.html#key

いかにも、と言ったところです。よく、「v-for の key に index を指定するな」という話があると思いますが、まさに今現時点では暗黙的に key が index になっているがために上記のような問題が発生していました。(c2 の長さを基準に for を回し、その index を元に c1 と patch を行っている)

# key 属性を元に patch しよう

そしてこれらを実装しているのが、``という関数です。(本家 Vue で探してみましょう。)

方針としては、まず新しい node の key と index のマップを生成します。

```ts
let i = 0;
const l2 = c2.length;
const e1 = c1.length - 1; // end index of prev node
const e2 = l2 - 1; // end index of next node

const s1 = i; // start index of prev node
const s2 = i; // start index of next node

const keyToNewIndexMap: Map<string | number | symbol, number> = new Map();
for (i = s2; i <= e2; i++) {
  const nextChild = (c2[i] = normalizeVNode(c2[i]));
  if (nextChild.key != null) {
    keyToNewIndexMap.set(nextChild.key, i);
  }
}
```

本家の Vue ではこの patchKeyedChildren は５のパートに分かれます。

1. sync from start
2. sync from end
3. common sequence + mount
4. common sequence + unmount
5. unknown sequence

ですが、上の 4 つは最適化のようなものなので、機能的には最後の `unknown sequence` だけで動作可能します。
なので、まずは`unknown sequence`の部分を読み進めて実装することにしましょう。

まずは、要素の移動のことは忘れて、key を元に VNode を patch していきましょう。
先ほど作った`keyToNewIndexMap`を利用して、n1 と n2 の組みを算出して patch します。
この時点で、新しくマウントするものや、アンマウントする必要があればその処理も行ってしまいます。

ざっくりいうとこういうこと ↓ (かなり省略しています。詳しくは vue/core の renderer.ts を読んでみてください。)

```ts
const toBePatched = e2 + 1;
const newIndexToOldIndexMap = new Array(toBePatched); // 新indexと旧indexとのマップ
for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0;

// e1 (旧 len)を元にループ
for (i = 0; i <= e1; i++) {
  const prevChild = c1[i];
  newIndex = keyToNewIndexMap.get(prevChild.key);
  if (newIndex === undefined) { // 新しいに存在しなければアンマウント
    unmount(prevChild);
  } else {
    newIndexToOldIndexMap[newIndex] = i + 1; // マップ形成
    patch(prevChild, c2[newIndex] as VNode, container); // パッチ処理
  }
}

for (i = toBePatched - 1; i >= 0; i--) {
  const nextIndex = i;
  const nextChild = c2[nextIndex] as VNode;
  if (newIndexToOldIndexMap[i] === 0) {
    // マップが存在しない(初期値のまま)のであれば新しくマウントするということになる。　(真にはあって、旧にはないということなので)
    patch(null, nextChild, container, anchor);
  }
}
```