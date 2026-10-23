ڕێنمایی بۆ دانانی ڤیدیۆی شێر (Lion Gift Video):

١. ناوی فایل:
   ڤیدیۆکەت دابنێ لەم فۆڵدەرە بەم ناوە:
   public/videos/lion.mp4
   یان
   public/videos/lion.webm

٢. لادانی باکگراوند (Chroma Key):
   کۆدەکە بە شێوەی ئۆتۆماتیکی باکگراوندەکەی لادەبات بە کاتی ڕاستەقینە (Real-Time Canvas Chroma Key):
   - ئەگەر باکگراوندی ڤیدیۆکەت کەسک (Green Screen) بوو: لە فایلەکەی src/constants/gifts.ts دابنێ:
     videoKeyColor: 'green'
   - ئەگەر شین (Blue Screen) بوو:
     videoKeyColor: 'blue'
   - ئەگەر سپی (White) بوو:
     videoKeyColor: 'white'
   - ئەگەر ڕەش (Black) بوو:
     videoKeyColor: 'black'
   - ئەگەر لە بنەڕەتەوە باکگراوندی نەبوو (Transparent WebM):
     videoKeyColor: 'none'

٣. ئەگەر فایلەکە نەبوو، سیستەمەکە ئۆتۆماتیکی شێری ئەنیمەیشنی 3D دەهێنێت تا هیچی لێ تێک نەچێت.
