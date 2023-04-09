---
title: "小さいリアクティブシステム"
---

# 今回目指す開発者インターフェース

ここからは Vue.js の醍醐味であるリアクティブシステムというものについてやっていきます。  
これ以前の実装は、見た目が Vue.js に似ていれど、それは見た目だけで機能的には全く Vue.js ではりません。  
たんに最初の開発者インターフェースを実装し、いろんな HTML を表示できるようにしてみました。

しかし、このままでは一度画面を描画するとその後はそのままで、Web アプリケーションとしてはただの静的なサイトになってしまっています。  
これから、もっちリッチな UI を構築するために状態を持たせたり、その状態が変わったら描画を更新したりと言ったことをやっていきます。

まずは例の如くどういった開発者インターフェースになるか考えてみましょう。  
以下のようなのはどうでしょうか?

```ts
import { createApp, h, reactive } from "chibivue";

const app = createApp({
  setup() {
    const state = reactive({ count: 0 });

    const increment = () => {
      state.count++;
    };

    return () =>
      h("div", { id: "my-app" }, [
        h("p", {}, [`count: ${state.count}`]),
        h("button", { onClick: increment }, ["increment"]),
      ]);
  },
});

app.mount("#app");
```

普段 SFC を利用した開発を行っている方は少々見慣れないかもしれません。  
これは、setup というオプションでステートをもち、render 関数を return する開発者インターフェースです。  
実際、Vue.js にはこういった記法があります。

https://vuejs.org/api/composition-api-setup.html#usage-with-render-functions

reactive 関数でステートを定義し、それを書き換える increment という関数を実装してボタンの click イベントにバインドしています。
やりたいことをまとめておくと、

- setup 関数を実行することで戻り値から vnode 取得用の関数を得る
- reactive 関数に渡したオブジェクトをリアクティブにする
- ボタンをクリックするたと、ステートが更新される
- ステートの更新を追跡して render 関数を再実行し、画面を再描画する

# リアクティブシステムとはどういうもの?

さてここで、そもそもリアクティブとは何だったかのおさらいです。
公式ドキュメントを参照してみます。

> リアクティブなオブジェクトは JavaScript プロキシで、通常のオブジェクトと同じように振る舞います。違いは、Vue がリアクティブなオブジェクトのプロパティアクセスと変更を追跡できることです。

[引用元](https://ja.vuejs.org/guide/essentials/reactivity-fundamentals.html)

> Vue の最も特徴的な機能の 1 つは、控えめなリアクティビティーシステムです。コンポーネントの状態はリアクティブな JavaScript オブジェクトで構成されています。状態を変更すると、ビュー (View) が更新されます。

[引用元](https://ja.vuejs.org/guide/extras/reactivity-in-depth.html)

要約してみると、「リアクティブなオブジェクトは変更があった時に画面が更新される」です。  
これの実現方法について考えるのは少し置いておいて、とりあえず先ほどあげた開発者インターフェースを実装してみます。

# setup 関数の実装

やることはとっても簡単です。
setup オプションをを受け取り実行し、あとはそれはこれまでの render オプションと同じように使えば OK です。

~/packages/runtime-core/componentOptions.ts を編集します。

```ts
export type ComponentOptions = {
  render?: Function;
  setup?: () => Function; // 追加
};
```

あとはそれを使うように。

```ts
// createAppAPI

const app: App = {
  mount(rootContainer: HostElement) {
    const componentRender = rootComponent.setup!();

    const updateComponent = () => {
      const vnode = componentRender();
      render(vnode, rootContainer);
    };

    updateComponent();
  },
};
```

```ts
// playground

import { createApp, h } from "chibivue";

const app = createApp({
  setup() {
    // ゆくゆくはここでステートを定義
    // const state = reactive({ count: 0 })

    return function render() {
      return h("div", { id: "my-app" }, [
        h("p", { style: "color: red; font-weight: bold;" }, ["Hello world."]),
        h(
          "button",
          {
            onClick() {
              alert("Hello world!");
            },
          },
          ["click me!"]
        ),
      ]);
    };
  },
});

app.mount("#app");
```

まあ、これだけです。
実際にはステートが変更された時にこの `updateComponent`を実行したいわけです。

# 小さいリアクティブシステムの実装

今回のメインテーマです。どうにかして、ステートが変更された時に`updateComponent`を実行したいです。
これの肝は以下の二つです。

- Proxy オブジェクト
- オブザーバ パターン

リアクティブシステムはこれらを組み合わせて実装されています。

まず、リアクティブシステムの実装方法についてではなく、それぞれについての説明をしてみます。

## Proxy オブジェクト

https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Proxy

Proxy はとても面白いオブジェクトです。

以下のように、引数にオブジェクトを渡し、new することで使います。

```ts
const o = new Proxy({ value: 1 });
console.log(o.value); // 1
```

この例だと、o は通常のオブジェクトとほぼ同じ動作をします。

ここで、面白いのが、Proxy は第 2 引数を取ることができ、ハンドラを登録することができます。  
このハンドラは何のハンドラかというと、オブジェクトの操作に対するハンドラです。以下の例をみてください。

```ts
const o = new Proxy(
  { value: 1, value2: 2 },

  {
    get(target, key, receiver) {
      console.log(`target:${target}, key: ${key}`);
      return target[key];
    },
  }
);
```

この例では生成するオブジェクトに対する設定を書き込んでいます。  
具体的には、このオブジェクトのプロパティにアクセス(get)した際、`\`target:${target}, key: ${key}\``をコンソールに出力します。  
実際にブラウザ等で動作を確認してみましょう。

![proxy_get](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/books/images/proxy_get.png)

この Proxy で生成したオブジェクトのプロパティから値を読み取った時に設定された処理が実行されているのがわかるかと思います。

同様に、set に対しても設定することができます。

```ts
const o = new Proxy(
  { value: 1, value2: 2 },
  {
    set(target, key, value, receiver) {
      console.log("hello from setter");
      target[key] = value;
      return true;
    },
  }
);
```

![proxy_set](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/books/images/proxy_set.png)

Proxy の理解はこの程度で OK です。

## オブザーバ パターン

オブザーバ パターンはデザインパターンの一種です。

https://ja.wikipedia.org/wiki/Observer_%E3%83%91%E3%82%BF%E3%83%BC%E3%83%B3

オブザーバパターンはあるオブジェクトのイベントを他のオブジェクトに通知するために用いられるデザインパターンで、 Observer と Subject というものが登場します。  
言葉で説明するよりもコードベースで説明した方がわかりやすいと思うので以下でコードベースの説明をします。

Observer というのはイベントを通知される側のインターフェースです。
この interface は`update`というというメソッドを持っています。

```ts
interface Observer {
  update(): void;
}
```

Subject というのはイベントを通知する側のインターフェースです。
このインターフェースは`observe`, `forget`, `notify`というメソッドを持っています。

```ts
interface Subject {
  observe(obs: Observer): void;
  forget(obs: Observer): void;
  notify(): void;
}
```

そしてこれらはこのように実装されます。

```ts
class O implements Observer {
  update() {
    console.log("event received!");
  }
}

class S implements Subject {
  private observers: Observer[] = [];

  observe(obs: Observer) {
    this.observers.push(obs);
  }

  forget() {
    this.observers = this.observers.filter((it) => it !== obs);
  }

  notify() {
    this.observers.forEach((it) => it.update());
  }
}
```

以下のように使います。

```ts
const obs1 = new O();
const obs2 = new O();
const obs3 = new O();

const sub = new S();

sub.observe(obs1);
sub.observe(obs2);
sub.observe(obs3);

sub.notify(); // 通知
```

わざわざこんなもの何に使うの? という感じがするかもしれませんが、とりあえずこれがオブザーバパターンだと思ってください。

## Proxy とオブザーバパターンでリアクティブシステムを実装してみる

改めて目的を明確にしておくと、今回の目的は「ステートが変更された時に`updateComponent`を実行したい」です。  
Proxy とオブザーバパターンを用いた実装の流れについて説明してみます。  
これを思い出してください。

```ts
const obs = new O();
const sub = new S();

sub.observe(obs);

sub.notify(); // 通知
```

obs(observer)はイベントを通知される側で、sub(subject)はイベントを通知する側でした。

<!-- TODO:Ï -->

<!-- TODO:Ï 図を載せる -->

```ts
export type Dep = Set<ReactiveEffect>;

export let activeEffect: ReactiveEffect | undefined;

const targetMap = new WeakMap<any, Dep>();

class ReactiveEffect {
  private deps: Dep[] = [];
  constructor(public fn: () => T) {}
  run() {
    return this.fn();
  }
}

function track(target: object) {
  let dep = targetMap.get(target);
  if (!dep) {
    targetMap.set(target, (dep = new Set()));
  }

  if (activeEffect) {
    dep.add(activeEffect);
    activeEffect.deps.push(dep);
  }
}

function trigger(target: object) {
  const dep = targetMap.get(target);

  const effects = [...dep];

  for (effect in effects) {
    effect.run();
  }
}
```

そしてこの track と trigger が実行されるタイミングですが、track はステートの読み取り時, trigger はステートの更新時に実行されます。
つまり Proxy で getter と setter を定義します。

```ts
const state = new Proxy(
  { count: 0 },
  {
    get(target, key, receiver) {
      track(target);
      return target[key];
    },
    set(target, key, value receiver) {
      target[key] = value;
      trigger(target);
      return true;
    },
  }
);
```
