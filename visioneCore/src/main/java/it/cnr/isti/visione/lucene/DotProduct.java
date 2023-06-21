package it.cnr.isti.visione.lucene;

import org.apache.lucene.index.FieldInvertState;
import org.apache.lucene.search.similarities.TFIDFSimilarity;
import org.apache.lucene.util.BytesRef;

/** Expert: Default scoring implementation. */
public class DotProduct extends TFIDFSimilarity {
  
  /** Sole constructor: parameter-free */
  public DotProduct() {}
/*
@Override
public float coord(int arg0, int arg1) {
	// TODO Auto-generated method stub
	return 1f;
}

@Override
public float decodeNormValue(long arg0) {
	// TODO Auto-generated method stub
	return 1f;
}

@Override
public long encodeNormValue(float arg0) {
	// TODO Auto-generated method stub
	return 1;
}
*/
@Override
public float idf(long arg0, long arg1) {
	// TODO Auto-generated method stub
	return 1f;
}
/*
@Override
public float lengthNorm(FieldInvertState arg0) {
	// TODO Auto-generated method stub
	return 1f;
}

@Override
public float queryNorm(float arg0) {
	// TODO Auto-generated method stub
	return 1f;
}
*/


@Override
public float tf(float arg0) {
	// TODO Auto-generated method stub
	return arg0;
}

@Override
public float lengthNorm(int arg0) {
	// TODO Auto-generated method stub
	return 1f;
}
  
  
}