import type { IContentRepository, ContentListOpts } from './content-repository'
import type { Post, PostListItem, CreatePostInput, UpdatePostInput } from '../types/post'

export interface IPostRepository extends IContentRepository<Post, CreatePostInput, UpdatePostInput, PostListItem> {
  getByAuthor(authorId: string, opts: ContentListOpts): Promise<PostListItem[]>
}
