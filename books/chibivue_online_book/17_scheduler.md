---
title: "スケジューラ"
---

# effect のスケジューリング

まずはこのコードを見てください。

```ts
import { createApp, h, reactive } from "chibivue";

const app = createApp({
  setup() {
    const state = reactive({
      message: "Hello World",
    });
    const updateList = () => {
      state.message = "Hello ChibiVue!";
      state.message = "Hello ChibiVue!!";
    };

    return () => {
      console.log("😎 rendered!");

      return h("div", { id: "app" }, [
        h("p", {}, [`message: ${state.message}`]),
        h("button", { onClick: updateList }, ["update"]),
      ]);
    };
  },
});

app.mount("#app");
```

ボタンをクリックすると、state.message に対して 2 回 set が起こるので、当然 2 回 trigger が実行されることになります。
つまりは、2 回仮想 DOM が算出され、2 回 patch が行われます。

![non_scheduled_effect](https://raw.githubusercontent.com/Ubugeeei/chibivue/main/books/images/non_scheduled_effect.png)

しかし、実際に patch 処理を行うのは 2 回目のタイミングだけで十分なはずです。  
そこで、スケジューラを実装します。スケジューラというのはあるタスクに対する実行順番であったり、実行を管理するものです。
Vue のスケジューラの役割の一つとして、リアクティブな作用をキューで管理し、まとめられるものはまとめる、というのがあります。

具体的には キュー をもち、ジョブを管理します。ジョブは id を持っており、キューに新しくジョブがエンキューされる際に、既に同一の id を持ったジョブが存在していた場合に上書きしてしまいます。

```ts
export interface SchedulerJob extends Function {
  id?: number;
}

const queue: SchedulerJob[] = [];

export function queueJob(job: SchedulerJob) {
  if (
    !queue.length ||
    !queue.includes(job, isFlushing ? flushIndex + 1 : flushIndex)
  ) {
    if (job.id == null) {
      queue.push(job);
    } else {
      queue.splice(findInsertionIndex(job.id), 0, job);
    }
    queueFlush();
  }
}
```

# nextTick が欲しい
