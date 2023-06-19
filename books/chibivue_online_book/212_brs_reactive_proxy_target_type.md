---
title: "オブジェクトの種類を判定する"
---

# リアクティブにするオブジェクトとしないオブジェクト

## 問題点

さて、ここでは現状のリアクティブシステムのある問題について解決していきます。  
まずは以下のコードを動かしてみてください。

```ts
import { createApp, h, ref } from "chibivue";

const app = createApp({
  setup() {
    const inputRef = ref<HTMLInputElement | null>(null);
    const getRef = () => {
      inputRef.value = document.getElementById(
        "my-input"
      ) as HTMLInputElement | null;
      console.log(inputRef.value);
    };

    return () =>
      h("div", {}, [
        h("input", { id: "my-input" }, []),
        h("button", { onClick: getRef }, ["getRef"]),
      ]);
  },
});

app.mount("#app");
```

コンソールを見てみると、以下のようになっていることが観測できるかと思います。

![reactive_html_element](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/books/images/reactive_html_element.png)

ここで、focus をする処理を加えてみましょう。

```ts
import { createApp, h, ref } from "chibivue";

const app = createApp({
  setup() {
    const inputRef = ref<HTMLInputElement | null>(null);
    const getRef = () => {
      inputRef.value = document.getElementById(
        "my-input"
      ) as HTMLInputElement | null;
      console.log(inputRef.value);
    };
    const focus = () => {
      inputRef.value?.focus();
    };

    return () =>
      h("div", {}, [
        h("input", { id: "my-input" }, []),
        h("button", { onClick: getRef }, ["getRef"]),
        h("button", { onClick: focus }, ["focus"]),
      ]);
  },
});

app.mount("#app");
```

なんと、エラーになってしまいます。

![focus_in_reactive_html_element](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/books/images/focus_in_reactive_html_element.png)

これの原因としては、document.getElementById によって取得した要素自体を元に Proxy を生成してしまっているためです。

Proxy を生成してしまうと値は当然元のオブジェクトではなく Proxy になってしまいますから、HTML 要素としての機能が失われてしまっているのです。

## reactive Proxy を生成する前にオブジェクトを判定する。

## TemplateRefs を実装してみる

Todo: toTypeString を利用した制限の実装と、それをもとに TemplateRefs の実装をする

<!--
# Template Refs

ref は ref 属性を利用することで template への参照を取ることができます。

https://vuejs.org/guide/essentials/template-refs.html

```ts
import { createApp, h, ref } from "chibivue";

const app = createApp({
  setup() {
    const inputRef = ref<HTMLInputElement | null>(null);
    const focus = () => {
      inputRef.value?.focus();
    };

    return () =>
      h("div", {}, [
        h("input", { ref: inputRef }, []),
        h("button", { onClick: focus }, ["focus"]),
      ]);
  },
});

app.mount("#app");
```

ここまでやってきたみなさんならば、実装方法はもう見えてるかと思います。
そう、VNode に ref を持たせて render 時に値をぶち込んでやればいいわけです。

```ts
export interface VNode<HostNode = any> {
  // .
  // .
  key: string | number | symbol | null;
  ref?: Ref; // これ
  // .
  // .
}
``` -->
