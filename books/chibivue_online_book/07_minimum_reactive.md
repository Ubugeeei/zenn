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

まず、Vue.js のリアクティブシステムには `target`, `Proxy`, `ReactiveEffect`, `Dep`, `track`, `trigger`, `targetMap`, `activeEffect`というものが登場します。

まず、targetMap の構造についてです。  
targetMap はある target の key と dep のマップングです。  
target というのはリアクティブにしたいオブジェクト、dep というのは実行したい作用(関数)だと思ってもらえれば大丈夫です。  
コードで表すとこういう感じになります。

```ts
type Target = any; // 任意のtarget
type TargetKey = any; // targetが持つ任意のkey

const targetMap = new WeakMap<Target, KeyToDepMap>(); // このモジュール内のグローバル変数として定義

type KeyToDepMap = Map<TargetKey, Dep>; // targetのkeyと作用のマップ

type Dep = Set<ReactiveEffect>; // depはReactiveEffectというものを複数持っている

class ReactiveEffect {
  constructor(
    // ここに実際に作用させたい関数を持たせます。 (今回でいうと、updateComponent)
    public fn: () => T
  ) {}
}
```

基本的な構造はこれが担っていて、あとはこの TargetMap をどう作っていくか(どう登録していくか)と実際に作用を実行するにはどうするかということを考えます。

そこで登場する概念が track と trigger です。
それぞれ名前の通り、track は TargetMap に登録する関数、trigger は TargetMap から作用を取り出して実行する関数です。

```ts
export function track(target: object, key: unknown) {
  // ..
}

export function trigger(target: object, key?: unknown) {
  // ..
}
```

そして、この track と trigger は Proxy の get と set のハンドラに実装されます。

```ts
const state = new Proxy(
  { count: 1 },
  {
    get(target, key, receiver) {
      track(target, key);
      return target[key];
    },
    set(target, key, value, receiver) {
      target[key] = value;
      trigger(target, key);
      return true;
    },
  }
);
```

この Proxy 生成のための API が reactive 関数です。

```ts
function reactive<T>(target: T) {
  return new Proxy(target, {
    get(target, key, receiver) {
      track(target, key);
      return target[key];
    },
    set(target, key, value, receiver) {
      target[key] = value;
      trigger(target, key);
      return true;
    },
  });
}
```

![reactive](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/books/images/reactive.png)

これらは先ほど説明したオブザーバパターンの応用です。このクラスを思い出してください。

```ts
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

少しこのクラスを元に置き換えてみましょう。
この class でいうところの observers が Dep に当たります。
ですが、この Dep の構造は少し複雑で、あるオブジェクトに対して、key ごとに Dep を分けています。
つまり、observers は targetMap です。

```ts
class S implements Subject {
  private targetMap = new WeekMap<Target, KeyToDepMap>();

  observe(obs: Observer) {
    //
  }

  forget() {
    //
  }

  notify() {
    //
  }
}
```

![reactive_observer](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/books/images/reactive_observer.png)

observe と notify が track と trigger にあたります。forget はありません。

```ts
class S implements Subject {
  private targetMap = new WeekMap<Target, KeyToDepMap>();

  track(target, key, effect: ???) {}

  trigger(target, key) {}
}
```

ここで、一つ足りない要素について気づくかもしれません。それは「track ではどの関数を登録するの?」という点です。
答えを言ってしまうと、これが `activeEffect` という概念です。
これは、targetMap と同様、このモジュール内のグローバル変数として定義されていて、ReactiveEffect の`run`というメソッドで随時設定されます。

```ts
let activeEffect: ReactiveEffect | undefined;

class ReactiveEffect {
  constructor(
    // ここに実際に作用させたい関数を持たせます。 (今回でいうと、updateComponent)
    public fn: () => T
  ) {}

  run() {
    activeEffect = this;
    return this.fn();
  }
}
```

どういう原理かというと、このようなコンポーネントを想像してください。

```ts
{
  setup() {
    const state = reactive({ count: 0 });
    const increment = () => state.count++;

    return function render() {
      return h("div", { id: "my-app" }, [
        h("p", {}, [`count: ${state.count}`]),
        h(
          "button",
          {
            onClick: increment,
          },
          ["increment"]
        ),
      ]);
    };
  },
}
```

これを、内部的には以下のようにリアクティブを形成します。

```ts
// chibivue 内部実装
const app: App = {
  mount(rootContainer: HostElement) {
    const componentRender = rootComponent.setup!();

    const updateComponent = () => {
      const vnode = componentRender();
      render(vnode, rootContainer);
    };

    const effect = new ReactiveEffect(updateComponent);
    effect.run();
  },
};
```

順を追って説明すると、まず、`setup` 関数が実行されます。
この時点で reactive proxy が生成されます。つまり、ここで作られた proxy に対してこれから何か操作があると proxy で設定した通り動作をとります。

```ts
const state = reactive({ count: 0 }); // proxyの生成
```

次に、`updateComponent` を渡して `ReactiveEffect` (Observer 側)を生成します。

```ts
const effect = new ReactiveEffect(updateComponent);
```

この `updateComponent` で使っている `componentRender` は `setup` の`戻り値`の関数です。そしてこの関数は proxy によって作られたオブジェクトを参照しています。

```ts
function render() {
  return h("div", { id: "my-app" }, [
    h("p", {}, [`count: ${state.count}`]), // proxy によって作られたオブジェクトを参照している
    h(
      "button",
      {
        onClick: increment,
      },
      ["increment"]
    ),
  ]);
}
```

実際にこの関数が走った時、`state.count` の `getter` 関数が実行され、`track` が実行されるようになっています。  
この状況下で、effect を実行してみます。

```ts
effect.run();
```

そうすると、今、`activeEffect` には `updateComponent` が設定されています。  
この状態で `track` が走るので、`targetMap` に `state`.count と `updateComponent` のマップが登録されます。  
これがリアクティブの形成です。

ここで、increment が実行された時のことを考えてみましょう。  
increment では `state.count` を書き換えているので `setter` が実行され、`trigger` が実行されます。  
`trigger` は `state` と `count` を元に `targetMap` から `effect`(今回の例だと updateComponent)をみつけ、実行します。
これで画面の更新が行われるようになりました!

これによって、以下のようにリアクティブを実現することができます。

ちょっとややこしいので図でまとめます。

![reactivity_create](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/books/images/reactivity_create.png)
