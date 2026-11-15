import Image from '@tiptap/extension-image'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import StarterKit from '@tiptap/starter-kit'

export function essayExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      link: false,
      underline: false,
      strike: false,
      horizontalRule: false,
      trailingNode: false,
      dropcursor: false
    }),
    Image.configure({ inline: false }),
    TaskList,
    TaskItem.configure({ nested: false })
  ]
}
