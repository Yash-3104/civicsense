from models.embeddings import generate_embedding
from utils.similarity import cosine_similarity

def compare_issue_similarity(
    source_text: str,
    candidate_texts: list[str]
):

    source_embedding = generate_embedding(
        source_text
    )

    scores = []

    for text in candidate_texts:

        candidate_embedding = generate_embedding(
            text
        )

        similarity = cosine_similarity(
            source_embedding,
            candidate_embedding
        )

        scores.append(round(similarity, 4))

    return scores