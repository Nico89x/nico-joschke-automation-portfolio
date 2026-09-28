# RAG retrieval and source governance

Retrieval-augmented generation, or RAG, gives an AI agent a small set of relevant internal documents before it creates an answer. It does not make unsupported facts acceptable. Every retrieved chunk keeps its source name, URL when available, content hash, chunk index, and retrieval score. The later solution architect can cite the source or state that the knowledge base does not contain enough evidence.

Knowledge ingestion is separated from retrieval. The ingestion process validates synthetic documents, splits them into stable chunks, stores metadata, and calculates an embedding. Retrieval is read-only. A RAG agent cannot silently edit the knowledge base, fetch arbitrary web pages, or contact companies.

The first local baseline uses deterministic hash embeddings only to test chunking, metadata, pgvector storage, and ranking without cost. It is intentionally not presented as a semantic production embedding model. A later phase can switch to an approved OpenAI-compatible embedding API and must record the model, dimension, tokens, and cost.
