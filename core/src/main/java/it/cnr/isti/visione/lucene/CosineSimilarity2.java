package it.cnr.isti.visione.lucene;

import org.apache.lucene.index.FieldInvertState;
import org.apache.lucene.search.similarities.ClassicSimilarity;
import org.apache.lucene.search.similarities.TFIDFSimilarity;
import org.apache.lucene.util.BytesRef;

/** Expert: Default scoring implementation. */
public class CosineSimilarity2 extends ClassicSimilarity {
  
  /** Sole constructor: parameter-free */
  public CosineSimilarity2() {}


@Override
public float idf(long arg0, long arg1) {
	// TODO Auto-generated method stub
	return 1f;
}

  
}