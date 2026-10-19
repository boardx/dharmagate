# Git, Release and LFS allocation

Research Markdown/TXT/TSV/JSON, the current and historical user reports, Word/PDF/Excel exports and licensed short PDF are normal Git files. None exceeds the 50 MiB warning or 100 MiB Git block threshold. The 18 MP3 files are retained byte-identically in a separately prepared audio ZIP; publish that ZIP as a Release asset so routine clones do not duplicate a large audio history. The ZIP exceeds 100 MiB and must not be committed to ordinary Git.

GitHub browser uploads have a 25 MiB limit; ordinary Git warns above 50 MiB and blocks above 100 MiB. Release assets must each be below 2 GiB. This prepared archive is below that limit. Git LFS is an optional alternative for future frequently versioned media, but this task neither activates LFS nor purchases quota or credentials.

Official sources checked 2026-10-19:
- https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github
- https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
- https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage
