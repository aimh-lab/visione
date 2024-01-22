package it.cnr.isti.visione.lucene;

import org.apache.lucene.search.similarities.ClassicSimilarity;

/** Expert: Default scoring implementation. */
public class CosineSimilarity2 extends ClassicSimilarity {

  /** Sole constructor: parameter-free */
  public CosineSimilarity2() {
  }

  @Override
  public float idf(long arg0, long arg1) {
    return 1f;
  }

}